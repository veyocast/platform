import{readFile,writeFile,mkdir}from'node:fs/promises';
import{chromium}from'@playwright/test';
import{buildSitesMenuPresentation}from'../../packages/content-templates/src/sites-dynamic-projector';
import{createSitesPresentationCapture}from'../../apps/media-worker/src/sites-dom-capture';
const directory=process.argv[3]!;await mkdir(directory,{recursive:true});
const document=JSON.parse(await readFile(process.argv[2]!,'utf8'));
for(const orientation of['landscape','portrait']as const)for(const mode of['light','dark']as const){
 const config={...document.sitesConfiguration,orientation,onzeTrotsStyle:`${process.argv[4]==='historical'?'v9-marker':'v10-barlow'}-${mode}`};
 const presentation=buildSitesMenuPresentation(document,config,'Eigen vereniging');if(!presentation)throw Error('Valid menu required');
 const capture=await createSitesPresentationCapture({presentation,durationMs:30000,executablePath:chromium.executablePath()});
 try{await writeFile(`${directory}/twelve-${process.argv[4]==='historical'?'before':'after'}-${orientation}-${mode}.png`,await capture.renderPng(1200));}finally{await capture.close();}
}
