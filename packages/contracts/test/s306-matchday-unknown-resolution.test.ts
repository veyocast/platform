import {describe,expect,it} from "vitest";
import fixture from "../../../tests/fixtures/s300-matchday-rpc.json";
import {matchdayFrozenTargetSchema,matchdayWorkspaceSchema} from "../src/matchday-runbook";

describe("S306 readable screens with an unknown resolution",()=>{
 it.each([[null,null],[null,1080],[1920,null]])("keeps an untargeted screen with dimensions %s × %s readable",(width,height)=>{
  const workspace=structuredClone(fixture["workspace-before-publish"]);
  const other={...workspace.options.screens[0]!,id:"30000000-0000-4000-8000-000000000999",name:"Nog niet gemeten",width,height};
  const result=matchdayWorkspaceSchema.parse({...workspace,options:{...workspace.options,screens:[...workspace.options.screens,other]}});
  expect(result.options.screens.at(-1)).toMatchObject({id:other.id,width,height});
  expect(result.selected?.configuration).toEqual(workspace.selected.configuration);
 });
 it.each([0,-1,1.5,"1920",undefined])("continues rejecting a malformed known dimension %s",width=>{
  const workspace=structuredClone(fixture["workspace-before-publish"]);
  workspace.options.screens[0]!.width=width as number;
  expect(matchdayWorkspaceSchema.safeParse(workspace).success).toBe(false);
 });
 it.each(["width","height"])("does not admit an unknown %s into a frozen publication target",key=>{
  const target=fixture.workspace.selected.publication.targets[0]!;
  expect(matchdayFrozenTargetSchema.safeParse({...target,[key]:null}).success).toBe(false);
 });
});
