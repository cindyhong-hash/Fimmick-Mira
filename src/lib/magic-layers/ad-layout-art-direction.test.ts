import assert from "node:assert/strict";
import test from "node:test";
import { parseArtDirection, type DirectionDecision } from "./ad-layout-art-direction.ts";
export const decision:DirectionDecision={direction:"product-focus",composition:"copy-left",typography:"bold",density:"minimal",support:"none",decoration:"one",accent:"primary",backdrop:"none",confidence:0.9};
test("accepts only three distinct bounded design directions",()=>{
 const valid={version:1,directions:[decision,{...decision,direction:"editorial"},{...decision,direction:"scene-led"}]};
 assert.ok(parseArtDirection(JSON.stringify(valid)));
 assert.ok(parseArtDirection(JSON.stringify({...valid,url:"injected"})));
 assert.equal(parseArtDirection(JSON.stringify({...valid,directions:[decision,decision,decision]})),null);
 for(const patch of [{confidence:2},{composition:"arbitrary"}])assert.equal(parseArtDirection(JSON.stringify({...valid,directions:[{...decision,...patch},...valid.directions.slice(1)]})),null);
 assert.ok(parseArtDirection(JSON.stringify({...valid,directions:[{...decision,url:"https://example.com"},...valid.directions.slice(1)]})));
 assert.equal(parseArtDirection("x".repeat(17000)),null);
});
