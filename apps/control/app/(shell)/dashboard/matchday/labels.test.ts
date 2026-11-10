import{describe,expect,it}from"vitest";
import{displayScreenResolution,matchLabel,unknownResolutionTargets}from"./labels";
import {matchdayWorkspaceSchema} from "@veyocast/contracts";
import fixture from "../../../../../../tests/fixtures/s300-matchday-rpc.json";
describe('explicit exact-match selection labels',()=>{it('only disambiguates genuinely colliding human labels with their official match codes',()=>{const a={id:'a',matchCode:'home-1',homeTeamName:'Eigen 1',awayTeamName:'Club 2',kickoffAt:'2026-11-09T12:00:00Z'},b={...a,id:'b',matchCode:'neutral-2'};expect(matchLabel(a,'Europe/Amsterdam',[a,b])).toContain(' · home-1');expect(matchLabel(b,'Europe/Amsterdam',[a,b])).toContain(' · neutral-2');expect(matchLabel(a,'Europe/Amsterdam',[a,{...b,kickoffAt:'2026-11-09T14:00:00Z'}])).not.toContain('home-1');});});
describe("S306 known and unknown screen profiles",()=>{
 it.each([[null,null],[null,1080],[1920,null]])("labels %s × %s as unknown without inventing dimensions",(width,height)=>{
  expect(displayScreenResolution(width,height)).toBe("Resolutie onbekend");
 });
 it("retains the actual known dimensions",()=>{expect(displayScreenResolution(1080,1920)).toBe("1080 × 1920");});
 it("checks selected direct and grouped screens while leaving unrelated unknown screens readable",()=>{
  const workspace=matchdayWorkspaceSchema.parse(fixture["workspace-before-publish"]),screen=workspace.options.screens[0]!;
  screen.width=null;
  const options={...workspace.options,groups:[{id:"group",name:"Groep",screenIds:[screen.id]}]};
  expect(unknownResolutionTargets([],options)).toEqual([]);
  expect(unknownResolutionTargets([{targets:[{kind:"screen",id:screen.id}]}],options)).toEqual([screen]);
  expect(unknownResolutionTargets([{targets:[{kind:"screen_group",id:"group"},{kind:"screen",id:screen.id}]}],options)).toEqual([screen]);
 });
});
