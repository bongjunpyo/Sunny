"use client";
import {createContext,useContext,useEffect,useReducer,useRef,useState,type ReactNode} from "react";
import type {ProductKind} from "../../lib/types.ts";
import {normalizeCart,addCartItem,type CartItem,type CartChoice} from "../../lib/cart.ts";
import type {OrderInput} from "../../lib/order-types.ts";
import s from "./site.module.css";
export type {CartItem} from "../../lib/cart.ts";
type Attempt={owner:string;fingerprint:string;key:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Store={favorites:ProductKind[];toggleFavorite:(k:ProductKind)=>void;cart:CartItem[];add:(item:CartChoice)=>void;
 quantity:(index:number,n:number)=>void;remove:(index:number)=>void;ready:boolean;cartMessage:string;checkoutBusy:boolean;
 lockCheckout:(busy:boolean)=>void;checkoutKey:(owner:string,input:OrderInput)=>Promise<string>;completeCheckout:(snapshot:CartItem[])=>void};
const Context=createContext<Store|null>(null);
type State={cart:CartItem[];message:string};
type Action={type:"hydrate";cart:CartItem[];message?:string}|{type:"add";item:CartChoice}|{type:"quantity";index:number;value:number}|{type:"remove";index:number}|{type:"complete";snapshot:CartItem[]};
function reducer(state:State,action:Action):State{
 try{
  if(action.type==="hydrate")return {cart:action.cart,message:action.message??""};
  if(action.type==="add")return {cart:addCartItem(state.cart,action.item),message:""};
  if(action.type==="quantity")return {cart:normalizeCart(state.cart.map((i,n)=>n===action.index?{...i,quantity:action.value}:i)),message:""};
  if(action.type==="remove")return {cart:state.cart.filter((_,n)=>n!==action.index),message:""};
  return {cart:state.cart.flatMap(i=>{const submitted=action.snapshot.find(x=>x.id===i.id);return !submitted?[i]:i.quantity>submitted.quantity?[{...i,quantity:i.quantity-submitted.quantity}]:[];}),message:""};
 }catch(error){return {...state,message:error instanceof Error?error.message:"장바구니를 확인해 주세요."};}
}
export function SiteProvider({children}:{children:ReactNode}){
 const [favorites,setFavorites]=useState<ProductKind[]>([]),[state,dispatch]=useReducer(reducer,{cart:[],message:""});
 const [ready,setReady]=useState(false),[checkoutBusy,setBusy]=useState(false),busy=useRef(false),attempt=useRef<Attempt|null>(null);
 useEffect(()=>{try{dispatch({type:"hydrate",cart:normalizeCart(JSON.parse(sessionStorage.getItem("sunny.design.cart")??"[]"))});}
  catch{dispatch({type:"hydrate",cart:[],message:"저장된 장바구니를 읽지 못했습니다. 구성을 다시 담아 주세요."});}
  try{const a=JSON.parse(sessionStorage.getItem("sunny.demo.checkout")??"null");if(a&&uuid.test(a.owner??"")&&/^[0-9a-f]{64}$/.test(a.fingerprint??"")&&uuid.test(a.key??""))attempt.current=a;}catch{}
  setReady(true);
 },[]);
 useEffect(()=>{if(ready)try{sessionStorage.setItem("sunny.design.cart",JSON.stringify(state.cart));}catch{}},[state.cart,ready]);
 return <Context.Provider value={{favorites,toggleFavorite:k=>setFavorites(old=>old.includes(k)?old.filter(x=>x!==k):[...old,k]),cart:state.cart,
  add:item=>{if(!busy.current)dispatch({type:"add",item});},quantity:(index,value)=>{if(!busy.current)dispatch({type:"quantity",index,value});},
  remove:index=>{if(!busy.current)dispatch({type:"remove",index});},ready,cartMessage:state.message,checkoutBusy,
  lockCheckout:value=>{busy.current=value;setBusy(value);},
  checkoutKey:async(owner,input)=>{
   const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(input)));
   const fingerprint=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
   if(attempt.current?.owner!==owner||attempt.current?.fingerprint!==fingerprint)attempt.current={owner,fingerprint,key:crypto.randomUUID()};
   try{sessionStorage.setItem("sunny.demo.checkout",JSON.stringify(attempt.current));}catch{}
   return attempt.current.key;
  },
  completeCheckout:snapshot=>{dispatch({type:"complete",snapshot});attempt.current=null;try{sessionStorage.removeItem("sunny.demo.checkout");}catch{}}
 }}><div className={s.site}>{children}</div></Context.Provider>;
}
export function useSite(){const value=useContext(Context);if(!value)throw new Error("SiteProvider required");return value;}
