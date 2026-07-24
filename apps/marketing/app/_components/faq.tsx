"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import type { ContentCard } from "../_content/pages";

export function FaqAccordion({ items }: { items: readonly ContentCard[] }) {
  return (
    <Accordion.Root className="faq-accordion" collapsible type="single">
      {items.map((item, index) => (
        <Accordion.Item className="faq-item" key={item.title} value={`faq-${index}`}>
          <Accordion.Header>
            <Accordion.Trigger>
              <span>{item.title}</span>
              <ChevronDown aria-hidden className="faq-item__icon" size={20} />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <div>
              <p>{item.body}</p>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
