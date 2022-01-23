import { readAll, readerFromStreamReader } from "https://deno.land/std@0.122.0/streams/conversion.ts";
// import { OpineRequest as Request } from "https://deno.land/x/opine@2.1.1/mod.ts";
import { ParserOptions } from "./metadata.ts";

async function getRaw(req: Request) {
  try {
    const body = req.body;
    if (body) {
      const reader = readerFromStreamReader(body.getReader());
      return await readAll(reader);
    }
  } catch {
    // Fail silently
  }
  return;
}

function getText(body: Uint8Array) {
  return new TextDecoder().decode(body);
}

function parseXmlToJson(xml: string) {
  const json: Record<string, unknown> = {};
  for (
    const res of xml.matchAll(
      /(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm,
    )
  ) {
    const key = res[1] || res[3];
    const value = res[2] && parseXmlToJson(res[2]);
    json[key] = ((value && Object.keys(value).length) ? value : res[2]) || null;
  }
  return json;
}

function parseValue(v: string) {
  if (!v) {
    return "";
  }
  if (!isNaN(Number(v))) {
    return +v;
  } else if (v === "true") {
    return true;
  } else if (v === "false") {
    return false;
  }
  return v;
}

// function parseFormFile(v: FormFile): FileData {
//   const ret: FileData = { name: v.filename, type: v.type, size: v.size };
//   if (v.content) {
//     ret.content = v.content;
//   } else {
//     ret.path = v.tempfile;
//   }
//   return ret;
// }

type ParserFn = (req: Request, options: ParserOptions) => Promise<{ decoded: unknown; raw: unknown; } | undefined>;

export const Parsers: Record<string, ParserFn> = {
  BINARY: async function (req, _) {
    const decoded = await getRaw(req);
    return { decoded, raw: decoded };
  },

  TEXT: async function (req, _) {
    const raw = await getRaw(req);
    if (!raw) {
      return;
    }
    const decoded = getText(raw);
    return { decoded, raw };
  },

  JSON: async function (req, _) {
    const raw = await getRaw(req);
    if (!raw) {
      return;
    }
    const decoded = JSON.parse(getText(raw));
    return { decoded, raw };
  },

  URL_ENCODED: async function (req, _) {
    const raw = await getRaw(req);
    if (!raw) {
      return;
    }
    const urlParams = new URLSearchParams(getText(raw));
    const decoded: any = {};
    for (const [k, v] of urlParams.entries()) {
      decoded[k] = parseValue(v);
    }
    return { decoded, raw };
  },

  XML: async function (req, options) {
    const raw = await getRaw(req);
    if (!raw) {
      return;
    }
    let decoded: string | Record<string, unknown> = getText(raw);
    if (options.xmlToJson === true) {
      decoded = parseXmlToJson(decoded);
    }
    return { decoded, raw };
  },

  // MFD: async function(req: Request, options: ParserOptions) {
  //     const ct = req.headers.get("content-type");
  //     const boundary=ct?.split(";")[1]?.split("=")[1];
  //     if(!boundary)
  //         return;
  //     const rdr = req.body!.getReader();
  //     const mr = new MultipartReader(rdr, boundary);
  //     const form = await mr.readForm();
  //     const decoded:any={};
  //     for(const entry of form.entries()) {
  //         const k=entry[0], v=entry[1];
  //         if(isFormFile(v)) {
  //             if(!decoded[INTERNAL_MFD_FILE_KEY])
  //                 decoded[INTERNAL_MFD_FILE_KEY]={};
  //             decoded[INTERNAL_MFD_FILE_KEY][k]=parseFormFile(v);
  //         }
  //         else
  //             decoded[k]=parseValue(v as unknown as string);
  //     }
  //     return {decoded, raw: await getRaw(req)};
  // },

  UNKNOWN: async function (req, options) {
    if (options.unknownAsText === true) {
      return await Parsers.TEXT(req, options);
    }
    return await Parsers.BINARY(req, options);
  },
};
