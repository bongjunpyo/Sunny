import {test} from "node:test";
import assert from "node:assert/strict";
import {addCartItem,normalizeCart,toOrderInput} from "../lib/cart.ts";
const owner="00000000-0000-4000-8000-000000000001",asset="00000000-0000-4000-8000-000000000002";
test("mixed cart retains separate products, quantities and round-moon-round necklace input",()=>{
 let cart=addCartItem([],{kind:"bracelet",color:"violet",length:"18 cm"});
 cart=addCartItem(cart,{kind:"necklace",color:"blue",length:"45 cm"});
 cart=addCartItem(cart,{kind:"bracelet",color:"violet",length:"18 cm"});
 const restored=normalizeCart(JSON.parse(JSON.stringify(cart)));assert.equal(restored.length,2);assert.equal(restored[0].quantity,2);
 const input=toOrderInput(restored,owner,true,false,false);assert.equal(input.items.length,2);assert.deepEqual(input.items[1].beadLayout,{moonCount:1,roundCount:2});
});
test("photo layouts stay separate and a session change cannot turn them into photo-free orders",()=>{
 const photos=Array<string|null>(7).fill(null);photos[0]=photos[1]=asset;
 const cart=addCartItem([],{kind:"bracelet",color:"violet",length:"18 cm",photoAssetIds:photos,photoOwnerId:owner});
 const two=addCartItem(cart,{kind:"bracelet",color:"violet",length:"18 cm"});assert.equal(two.length,2);
 assert.throws(()=>toOrderInput(two,"00000000-0000-4000-8000-000000000009",true,true,false),/다른 세션/);
 assert.throws(()=>toOrderInput(two,owner,true,false,false),/동의/);
 const input=toOrderInput(two,owner,true,true,false);assert.equal(input.items[0].photoBrandUseConsent?.accepted,false);
 assert.deepEqual((input.items[0].beadLayout as {beads:unknown[]}).beads.slice(0,2),[{index:0,photoAssetId:asset},{index:1,photoAssetId:asset}]);
});
test("cart does not silently accept damaged photo ownership or excessive quantities",()=>{
 const cart=addCartItem([],{kind:"bracelet",color:"blue",length:"16 cm"});
 assert.throws(()=>normalizeCart([{...cart[0],quantity:11}]));
 assert.throws(()=>normalizeCart([{...cart[0],photoAssetIds:[asset,...Array(6).fill(null)],photoOwnerId:null}]));
 assert.throws(()=>normalizeCart([{...cart[0],kind:"necklace",length:"45 cm",photoAssetIds:[asset]}]));
 assert.throws(()=>toOrderInput(cart,owner,false,false,false),/확인/);
});
