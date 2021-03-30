import { ServerRequest } from "https://deno.land/std/http/server.ts";
import { ParserOptions } from "./metadata.ts";

async function getRaw(req: ServerRequest) {
    try {
        return await Deno.readAll(req.body);
    } catch(err) {}
    return;
}

function getText(body: Uint8Array) {
    return new TextDecoder().decode(body);
}

function parseXmlToJson(xml:string) {
    const json:any = {};
    for (const res of xml.matchAll(/(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm)) {
        const key = res[1] || res[3];
        const value = res[2] && parseXmlToJson(res[2]);
        json[key] = ((value && Object.keys(value).length) ? value : res[2]) || null;

    }
    return json;
}

function parseValue(v:string) {
    if(!v)
        return "";
    if(!isNaN(Number(v)))
        return +v;
    else if(v==="true")
        return true;
    else if(v==="false")
        return false
    return v;
}

export const Parsers: Record<string, Function> = {

    BINARY: async function(req: ServerRequest, options: ParserOptions) {
        const decoded=await getRaw(req);
        return {decoded, raw: decoded};
    },

    TEXT: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        const decoded=getText(raw);
        return {decoded, raw};
    },

    JSON: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        const decoded=JSON.parse(getText(raw));
        return {decoded, raw};
    },

    URL_ENCODED: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        const urlParams=new URLSearchParams(getText(raw));
        const decoded:any={};
        for(const [k, v] of urlParams.entries())
            decoded[k]=parseValue(v);
        return {decoded, raw};
    },

    XML: async function(req: ServerRequest, options: ParserOptions) {
        const raw=await getRaw(req);
        if(!raw)
            return;
        let decoded=getText(raw);
        if(options.xmlToJson === true)
            decoded=parseXmlToJson(decoded);
        return {decoded, raw};
    },

    MFD: async function(req: ServerRequest, options: ParserOptions) {
        
    },

    UNKNOWN: async function(req: ServerRequest, options: ParserOptions) {
        if(options.unknownAsText === true)
            return await Parsers.TEXT(req, options);
        return await Parsers.BINARY(req, options);
    }
};