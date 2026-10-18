if(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE!=='1')throw Error('Set the explicit isolated S226 acceptance gate before running this archived journey');
import {chromium}from'/home/codex/repos/castivo-s226/node_modules/@playwright/test/index.mjs';
import{createRequire}from'node:module';import fs from'node:fs';
const require=createRequire('/home/codex/repos/castivo-s226/apps/media-worker/package.json');const sharp=require('sharp');
const root='/home/codex/repos/castivo-s226',out=root+'/execution/evidence/visual-marketing';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch();const c=await b.newContext({locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce',deviceScaleFactor:1});const p=await c.newPage();const report=[];
try{for(const[width,height]of[[1440,1000],[390,900]])for(const route of['/','/narrowcasting/','/functies/','/koppelingen/','/players/','/demo/','/oplossingen/sportverenigingen/','/oplossingen/horeca/','/oplossingen/bedrijven/']){
 await p.setViewportSize({width,height});const key=(route==='/'?'home':route.replaceAll('/','-').replace(/^-|-$/g,''))+'-'+width;const row={route,width,height,dpr:1,state:'initial-public-no-storage',referenceCommit:'69461726f0d9e17b535dfaa0652cc18ed75c1fdd'};
 for(const[k,origin]of[['reference','http://127.0.0.1:3229'],['rebuild','http://127.0.0.1:3228']]){
  const r=await p.goto(origin+route,{timeout:60000});if(r.status()!==200)throw Error(k+route+' status '+r.status());await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}window.scrollTo(0,0);await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  await p.waitForTimeout(250);const path=out+'/'+key+'-'+k+'.png';await p.screenshot({path,fullPage:true,animations:'disabled'});
  row[k]={screenshot:path.slice(root.length+1),height:await p.evaluate(()=>document.documentElement.scrollHeight),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),h1:await p.locator('h1').innerText(),geometry:await p.locator('.mk-nav,.mk-hero,.mk-hero-copy,.mk-hero-visual,h1').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{selector:el.tagName==='H1'?'h1':el.className,x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight};}))};
 }
 const a=await sharp(root+'/'+row.reference.screenshot).ensureAlpha().raw().toBuffer({resolveWithObject:true});const z=await sharp(root+'/'+row.rebuild.screenshot).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const h=Math.max(a.info.height,z.info.height),w=width,diff=Buffer.alloc(w*h*4);let changed=0,common=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;let d=255;if(y<a.info.height&&y<z.info.height){d=Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-z.data[i+k])));common++;}if(d>16){changed++;diff[i]=220;diff[i+1]=30;diff[i+2]=80;diff[i+3]=255;}else{diff[i]=diff[i+1]=diff[i+2]=235;diff[i+3]=255;}}
 const dp=out+'/'+key+'-diff.png';await sharp(diff,{raw:{width:w,height:h,channels:4}}).png().toFile(dp);row.diff=dp.slice(root.length+1);row.changedPixels=changed;row.changedFraction=changed/(w*h);row.sameDimensions=a.info.height===z.info.height;row.result=changed===0?'PIXEL_EQUAL':'REVIEW_DIFFERENCES';report.push(row);console.log(JSON.stringify({route,width,referenceHeight:a.info.height,rebuildHeight:z.info.height,changedFraction:row.changedFraction}));
 fs.writeFileSync(out+'/comparison.json',JSON.stringify(report,null,2)+'\n');
}}finally{await b.close();}
