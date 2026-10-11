"use client";
import {createContext,useContext,type ImgHTMLAttributes} from "react";
export const SitesSystemAssetUrls=createContext<Readonly<Record<string,string>>>({});
/** URLs exist only after resolving verified snapshot assets, never in saved documents. */
export function useAssetUrl(value: string) { const urls=useContext(SitesSystemAssetUrls);return urls[value]??value; }
export function AssetImage(props: ImgHTMLAttributes<HTMLImageElement>) { return <img {...props} src={useAssetUrl(typeof props.src==="string"?props.src:"")} />; }
