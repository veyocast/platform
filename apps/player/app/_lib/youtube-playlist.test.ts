import {describe,expect,it} from "vitest";
import {youtubePlaylistVideoIdsSchema} from "@veyocast/contracts";
import {nextYouTubePlaylistIndex} from "./youtube-playlist";
const videos=["aaaaaaaaaaa","bbbbbbbbbbb","aaaaaaaaaaa"];
describe("official YouTube playlist playback order",()=>{
 it("retains repeated occurrences in the verified official order",()=>{expect(youtubePlaylistVideoIdsSchema.parse(videos)).toEqual(videos);expect(nextYouTubePlaylistIndex({videos,current:1,unavailable:new Set(),repeat:false,boundaryRequested:false})).toBe(2);});
 it("skips unavailable videos and repeats only when enabled",()=>{expect(nextYouTubePlaylistIndex({videos,current:0,unavailable:new Set(["bbbbbbbbbbb"]),repeat:false,boundaryRequested:false})).toBe(2);expect(nextYouTubePlaylistIndex({videos,current:2,unavailable:new Set(),repeat:true,boundaryRequested:false})).toBe(0);expect(nextYouTubePlaylistIndex({videos,current:2,unavailable:new Set(),repeat:false,boundaryRequested:false})).toBeNull();});
 it("finishes at the healthy video boundary and terminates an unavailable-only playlist",()=>{expect(nextYouTubePlaylistIndex({videos,current:0,unavailable:new Set(),repeat:true,boundaryRequested:true})).toBeNull();expect(nextYouTubePlaylistIndex({videos,current:0,unavailable:new Set(videos),repeat:true,boundaryRequested:false})).toBeNull();expect(youtubePlaylistVideoIdsSchema.safeParse(Array(201).fill(videos[0])).success).toBe(false);});
});
