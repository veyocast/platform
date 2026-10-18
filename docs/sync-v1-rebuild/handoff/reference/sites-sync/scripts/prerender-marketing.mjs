import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import React from 'react';
import {renderToString} from 'react-dom/server';

const origin=(process.env.MARKETING_SITE_URL||'https://veyocast.dgwebserv.chatgpt.site').replace(/\/$/,'');
const appHref=process.env.MARKETING_APP_URL||'https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync';
const arg=(key)=>process.argv.find(x=>x.startsWith('--'+key+'='))?.split('=').slice(1).join('=');
const output=path.resolve(arg('dir')||process.env.MARKETING_OUTPUT_DIR||'dist');
const templateName=arg('template')||'index.html';
if(!/^https:\/\//.test(origin))throw new Error('MARKETING_SITE_URL must be an absolute HTTPS origin.');
const template=await fs.readFile(path.join(output,templateName),'utf8');
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const upsert=(html,name,content,attr='name')=>{const re=new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, 'i');const tag=`<meta ${attr}="${name}" content="${escape(content)}"/>`;return re.test(html)?html.replace(re,tag):html.replace('</head>',tag+'\n</head>')};
try{
 const {default:Marketing,marketingPages}=await server.ssrLoadModule('/src/Marketing.tsx');
 const now=new Date().toISOString().slice(0,10);const urls=[];
 for(const [page,meta] of Object.entries(marketingPages)){
  const canonical=origin+page;const htmlBody=renderToString(React.createElement(Marketing,{page,appHref}));
  let html=template.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(meta.title)}</title>`).replace(/<div id="root">[\s\S]*?<\/div>(?=\s*<script|\s*<\/body>)/,`<div id="root">${htmlBody}</div>`);
  // A built Vite template commonly moves its entry script to <head>.
  if(!html.includes('mk-site'))html=html.replace('<div id="root"></div>',`<div id="root">${htmlBody}</div>`);
  html=upsert(html,'description',meta.description);html=upsert(html,'robots','index,follow,max-image-preview:large');
  html=upsert(html,'theme-color','#073f45');html=upsert(html,'og:type','website','property');html=upsert(html,'og:locale','nl_NL','property');html=upsert(html,'og:site_name','VeyoCast','property');html=upsert(html,'og:title',meta.title,'property');html=upsert(html,'og:description',meta.description,'property');html=upsert(html,'og:url',canonical,'property');html=upsert(html,'og:image',origin+'/assets/brand-hero-1254.webp','property');html=upsert(html,'og:image:width','1254','property');html=upsert(html,'og:image:height','1254','property');html=upsert(html,'og:image:alt','VeyoCast beeldmerk met verlichte teal en mint schermen','property');html=upsert(html,'twitter:card','summary_large_image');html=upsert(html,'twitter:title',meta.title);html=upsert(html,'twitter:description',meta.description);html=upsert(html,'twitter:image',origin+'/assets/brand-hero-1254.webp');
  html=html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/g,'').replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/g,'');
  const schema={'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':origin+'/#organization',name:'VeyoCast',url:origin+'/',logo:{'@type':'ImageObject',url:origin+'/assets/brand-icon.svg'},description:'Narrowcasting voor sportverenigingen, horeca en organisaties.'},{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'VeyoCast',inLanguage:'nl-NL',publisher:{'@id':origin+'/#organization'}},{'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:meta.title,description:meta.description,inLanguage:'nl-NL',isPartOf:{'@id':origin+'/#website'}},...(page!=='/'?[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},{'@type':'ListItem',position:2,name:meta.label,item:canonical}]}]:[])]};
  html=html.replace('</head>',`<link rel="canonical" href="${escape(canonical)}"/>\n<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>\n</head>`);
  const target=path.join(output,page.replace(/^\//,''),'index.html');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,html);urls.push(canonical);
 }
 await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${escape(url)}</loc><lastmod>${now}</lastmod></url>`).join('\n')}\n</urlset>\n`);
 await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /player/\nDisallow: /admin/\n\nSitemap: ${origin}/sitemap.xml\n`);
 // A real static error document avoids presenting another indexable marketing page for unknown paths.
 const notFound=template.replace(/<title>[\s\S]*?<\/title>/,'<title>Pagina niet gevonden | VeyoCast</title>').replace('<div id="root"></div>','<main style="font:16px/1.7 system-ui;max-width:650px;margin:15vh auto;padding:30px"><h1>Deze pagina bestaat niet.</h1><p>Ga terug naar VeyoCast om je schermverhaal te ontdekken.</p><a href="/">Terug naar home</a></main>').replace(/<script[^>]+type="module"[^>]*><\/script>/g,'');
 await fs.writeFile(path.join(output,'404.html'),upsert(notFound,'robots','noindex,follow'));
 if(templateName!=='index.html')await fs.rm(path.join(output,templateName),{force:true});
 console.log(`Prerendered ${urls.length} marketing pages, sitemap.xml, robots.txt and 404.html for ${origin}.`);
}finally{await server.close()}
