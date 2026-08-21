import {
  menuDocumentV2Schema,
  menuStudioCommandSchema,
  type MenuBlock,
  type MenuDocumentV2,
  type MenuStudioCommand
} from "@veyocast/contracts";

export type MenuStudioMutationResult =
  | { document: MenuDocumentV2; ok: true }
  | {
      code: "invalid-command" | "invalid-document" | "not-found" | "revision-conflict";
      message: string;
      ok: false;
    };

export type MenuStudioHistory = {
  future: MenuDocumentV2[];
  limit: number;
  past: MenuDocumentV2[];
  present: MenuDocumentV2;
};

export function applyMenuStudioCommand(
  documentValue: unknown,
  commandValue: unknown,
  updatedAt: string
): MenuStudioMutationResult {
  const document = menuDocumentV2Schema.safeParse(documentValue);
  if (!document.success) {
    return {
      code: "invalid-document",
      message: document.error.issues[0]?.message ?? "Het menudocument is ongeldig.",
      ok: false
    };
  }
  const command = menuStudioCommandSchema.safeParse(commandValue);
  if (!command.success) {
    return {
      code: "invalid-command",
      message: command.error.issues[0]?.message ?? "Het Menu Studio-commando is ongeldig.",
      ok: false
    };
  }
  if (command.data.baseRevision !== document.data.revision) {
    return {
      code: "revision-conflict",
      message: "Het menu is intussen gewijzigd. Vernieuw en pas de wijziging opnieuw toe.",
      ok: false
    };
  }
  if (!Number.isFinite(Date.parse(updatedAt))) {
    return {
      code: "invalid-command",
      message: "Het wijzigingsmoment is ongeldig.",
      ok: false
    };
  }

  const candidate = clone(document.data);
  const failure = mutate(candidate, command.data);
  if (failure) return failure;
  candidate.revision += 1;
  candidate.updatedAt = updatedAt;
  const validated = menuDocumentV2Schema.safeParse(candidate);
  if (!validated.success) {
    return {
      code: "invalid-document",
      message: validated.error.issues[0]?.message ?? "De wijziging zou een ongeldig menu maken.",
      ok: false
    };
  }
  return { document: validated.data, ok: true };
}

export function createMenuStudioHistory(
  document: MenuDocumentV2,
  limit = 50
): MenuStudioHistory {
  return {
    future: [],
    limit: Math.min(100, Math.max(1, Math.trunc(limit))),
    past: [],
    present: document
  };
}

export function commitMenuStudioHistory(
  history: MenuStudioHistory,
  next: MenuDocumentV2
): MenuStudioHistory {
  if (next.id !== history.present.id || next.tenantId !== history.present.tenantId) {
    return history;
  }
  return {
    ...history,
    future: [],
    past: [...history.past, history.present].slice(-history.limit),
    present: next
  };
}

export function undoMenuStudioHistory(history: MenuStudioHistory): MenuStudioHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    ...history,
    future: [history.present, ...history.future].slice(0, history.limit),
    past: history.past.slice(0, -1),
    present: previous
  };
}

export function redoMenuStudioHistory(history: MenuStudioHistory): MenuStudioHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    ...history,
    future: history.future.slice(1),
    past: [...history.past, history.present].slice(-history.limit),
    present: next
  };
}

export function rebaseMenuStudioHistory(
  history: MenuStudioHistory,
  confirmed: MenuDocumentV2
): MenuStudioHistory {
  return createMenuStudioHistory(confirmed, history.limit);
}

function mutate(
  document: MenuDocumentV2,
  command: MenuStudioCommand
): Exclude<MenuStudioMutationResult, { ok: true }> | null {
  const operation = command.operation;
  if (operation.kind === "set-title") {
    document.title = operation.title;
    return null;
  }
  if (operation.kind === "set-theme") {
    document.theme = operation.theme;
    return null;
  }
  if (operation.kind === "attach-asset") {
    const existingIndex = document.assets.findIndex(
      (asset) => asset.assetId === operation.asset.assetId
    );
    if (existingIndex >= 0) document.assets[existingIndex] = operation.asset;
    else document.assets.push(operation.asset);
    return null;
  }
  if (operation.kind === "detach-asset") {
    if (documentUsesAsset(document, operation.assetId)) {
      return {
        code: "invalid-command",
        message: "Dit bestand wordt nog in het menu gebruikt. Verwijder eerst het bijbehorende blok.",
        ok: false
      };
    }
    document.assets = document.assets.filter(
      (asset) => asset.assetId !== operation.assetId
    );
    return null;
  }
  if (operation.kind === "restore-content") {
    document.assets = clone(operation.assets);
    document.pages = clone(operation.pages);
    document.theme = clone(operation.theme);
    if (operation.providerSnapshot) {
      document.providerSnapshot = clone(operation.providerSnapshot);
    } else {
      delete document.providerSnapshot;
    }
    if (operation.title === null) delete document.title;
    else document.title = operation.title;
    return null;
  }
  const page = document.pages.find((candidate) => candidate.id === operation.pageId);
  if (!page) return notFound("De gekozen menupagina bestaat niet meer.");

  if (operation.kind === "add-block") {
    page.blocks.push(operation.block);
    page.blocks = normalizeBlockOrder(page.blocks);
    return null;
  }
  if (operation.kind === "replace-block") {
    const blockIndex = page.blocks.findIndex((block) => block.id === operation.block.id);
    if (blockIndex < 0) return notFound("Het gekozen menublok bestaat niet meer.");
    page.blocks[blockIndex] = operation.block;
    page.blocks = normalizeBlockOrder(page.blocks);
    return null;
  }
  if (operation.kind === "remove-block") {
    const blockIndex = page.blocks.findIndex((block) => block.id === operation.blockId);
    if (blockIndex < 0) return notFound("Het gekozen menublok bestaat niet meer.");
    page.blocks.splice(blockIndex, 1);
    page.blocks = normalizeBlockOrder(page.blocks);
    return null;
  }
  if (operation.kind === "move-block") {
    const blockIndex = page.blocks.findIndex((block) => block.id === operation.blockId);
    if (blockIndex < 0) return notFound("Het gekozen menublok bestaat niet meer.");
    const [moving] = page.blocks.splice(blockIndex, 1);
    if (!moving) return notFound("Het gekozen menublok bestaat niet meer.");
    const beforeIndex = operation.beforeBlockId === null
      ? page.blocks.length
      : page.blocks.findIndex((block) => block.id === operation.beforeBlockId);
    if (beforeIndex < 0) return notFound("De gekozen invoegpositie bestaat niet meer.");
    page.blocks.splice(beforeIndex, 0, moving);
    page.blocks = normalizeBlockOrder(page.blocks);
    return null;
  }

  const category = page.blocks.find(
    (block): block is Extract<MenuBlock, { type: "category" }> =>
      block.id === operation.categoryBlockId && block.type === "category"
  );
  if (!category) return notFound("De gekozen categorie bestaat niet meer.");
  if (operation.kind === "rename-category") {
    category.labelOverride = operation.labelOverride;
    return null;
  }
  if (operation.kind === "remove-product-node") {
    const before = category.productNodes.length;
    category.productNodes = category.productNodes.filter(
      (node) => node.id !== operation.nodeId
    );
    if (category.productNodes.length === before) {
      return notFound("Het gekozen product of de productgroep bestaat niet meer.");
    }
    category.productNodes = category.productNodes.map((node, index) => ({
      ...node,
      order: index
    }));
    return null;
  }
  if (operation.kind === "move-product-node") {
    const nodeIndex = category.productNodes.findIndex((node) => node.id === operation.nodeId);
    if (nodeIndex < 0) return notFound("Het gekozen product of de productgroep bestaat niet meer.");
    const [moving] = category.productNodes.splice(nodeIndex, 1);
    if (!moving) return notFound("Het gekozen product of de productgroep bestaat niet meer.");
    const beforeIndex = operation.beforeNodeId === null
      ? category.productNodes.length
      : category.productNodes.findIndex((node) => node.id === operation.beforeNodeId);
    if (beforeIndex < 0) return notFound("De gekozen invoegpositie bestaat niet meer.");
    category.productNodes.splice(beforeIndex, 0, moving);
    category.productNodes = normalizeProductOrder(category.productNodes);
    return null;
  }
  if (operation.kind === "group-product-nodes") {
    const nodeIds = new Set(operation.nodeIds);
    if (nodeIds.size !== operation.nodeIds.length) {
      return invalidCommand("Een product kan niet tweemaal in dezelfde groepeeractie staan.");
    }
    const selected = category.productNodes.filter((node) => nodeIds.has(node.id));
    if (selected.length !== nodeIds.size || selected.some((node) => node.kind !== "product")) {
      return notFound("Niet alle gekozen losse producten bestaan nog in deze categorie.");
    }
    const selectedKeys = selected.flatMap((node) =>
      node.kind === "product" ? [productKey(node.productRef)] : []
    ).sort();
    const groupKeys = operation.group.secondaryLineItems.flatMap((line) =>
      line.kind === "linked-product" ? [productKey(line.productRef)] : []
    ).sort();
    if (JSON.stringify(selectedKeys) !== JSON.stringify(groupKeys)) {
      return invalidCommand("De gekoppelde groepsregels komen niet exact overeen met de gekozen producten.");
    }
    const targetOrder = Math.min(...selected.map((node) => node.order));
    category.productNodes = normalizeProductOrder([
      ...category.productNodes.filter((node) => !nodeIds.has(node.id)),
      { ...operation.group, order: targetOrder }
    ]);
    return null;
  }
  if (operation.kind === "ungroup-product-node") {
    const group = category.productNodes.find(
      (node) => node.id === operation.groupId && node.kind === "product-group"
    );
    if (!group || group.kind !== "product-group") {
      return notFound("De gekozen productgroep bestaat niet meer.");
    }
    const groupKeys = group.secondaryLineItems.flatMap((line) =>
      line.kind === "linked-product" ? [productKey(line.productRef)] : []
    ).sort();
    const productKeys = operation.products.map((product) => productKey(product.productRef)).sort();
    if (JSON.stringify(groupKeys) !== JSON.stringify(productKeys)) {
      return invalidCommand("De losse producten komen niet exact overeen met de gekoppelde groepsregels.");
    }
    category.productNodes = normalizeProductOrder([
      ...category.productNodes.filter((node) => node.id !== group.id),
      ...operation.products.map((product, index) => ({
        ...product,
        order: group.order + index
      }))
    ]);
    return null;
  }
  const existingIndex = category.productNodes.findIndex(
    (node) => node.id === operation.node.id
  );
  if (existingIndex >= 0) category.productNodes[existingIndex] = operation.node;
  else category.productNodes.push(operation.node);
  category.productNodes = category.productNodes
    .slice()
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((node, index) => ({ ...node, order: index }));
  return null;
}

function documentUsesAsset(document: MenuDocumentV2, assetId: string) {
  if (document.theme.brand.logoAssetId === assetId) return true;
  return document.pages.some((page) => page.blocks.some((block) => {
    if (block.type === "image" || block.type === "logo") {
      return block.assetId === assetId;
    }
    if (block.type === "video") {
      return block.assetId === assetId || block.playback.posterAssetId === assetId;
    }
    if (block.type === "promo") return block.assetId === assetId;
    if (block.type === "product-group") {
      return block.group.imageAssetId === assetId || block.group.logoAssetId === assetId;
    }
    if (block.type !== "category") return false;
    return block.productNodes.some((node) => {
      if (node.kind === "product") {
        return node.mediaOverrideAssetId === assetId ||
          node.snapshotFallback.imageAssetId === assetId;
      }
      return node.imageAssetId === assetId || node.logoAssetId === assetId ||
        node.secondaryLineItems.some((line) => line.kind === "linked-product" && (
          line.mediaOverrideAssetId === assetId ||
          line.snapshotFallback.imageAssetId === assetId
        ));
    });
  }));
}

function normalizeBlockOrder(blocks: MenuBlock[]): MenuBlock[] {
  return blocks
    .slice()
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((block, index) => ({ ...block, order: index }));
}

function normalizeProductOrder<T extends { id: string; order: number }>(nodes: T[]): T[] {
  return nodes
    .slice()
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((node, index) => ({ ...node, order: index }));
}

function productKey(product: {
  productId: string;
  providerConnectionId?: string;
  source: "manual" | "twelve";
}) {
  return `${product.source}:${product.providerConnectionId ?? "manual"}:${product.productId}`;
}

function invalidCommand(message: string): Exclude<MenuStudioMutationResult, { ok: true }> {
  return { code: "invalid-command", message, ok: false };
}

function notFound(message: string): Exclude<MenuStudioMutationResult, { ok: true }> {
  return { code: "not-found", message, ok: false };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
