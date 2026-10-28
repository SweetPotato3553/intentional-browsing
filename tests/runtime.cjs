const path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const candidates=[process.env.PLAYWRIGHT_MODULE_PATH,'playwright',path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright')].filter(Boolean);
let playwrightModule;
for(const candidate of candidates){try{playwrightModule=require.resolve(candidate);break;}catch{}}
if(!playwrightModule)throw new Error('Install the development dependency with npm install, or set PLAYWRIGHT_MODULE_PATH.');
const edge=process.env.EDGE_EXECUTABLE||path.join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft','Edge','Application','msedge.exe');
module.exports={chromium:require(playwrightModule).chromium,playwrightModule,browserPath:fs.existsSync(edge)?edge:undefined};

// UI layout tests need selector access. Production closed roots are independently
// checked through CDP in release-regression; only this temporary copy is opened.
module.exports.inspectableExtension = function(source) {
  const copy=fs.mkdtempSync(path.join(os.tmpdir(),'still-ui-test-'));
  fs.cpSync(source,copy,{recursive:true,filter:file=>!file.split(path.sep).includes('_metadata')});
  const guard=path.join(copy,'guard.js');
  fs.writeFileSync(guard,fs.readFileSync(guard,'utf8').replaceAll('attachShadow({mode: "closed"})','attachShadow({mode: "open"})'));
  return copy;
};
module.exports.closedClick = async function(page, selector) {
  const client=await page.context().newCDPSession(page);
  try {
    const {root}=await client.send('DOM.getDocument',{depth:-1,pierce:true});
    async function walk(node) {
      if(node.nodeType===1){
        const {object}=await client.send('DOM.resolveNode',{backendNodeId:node.backendNodeId});
        const result=await client.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(selector){if(this.matches(selector)){this.click();return true;}return false;}',arguments:[{value:selector}],returnByValue:true});
        if(result.result.value)return true;
      }
      for(const child of [...(node.children||[]),...(node.shadowRoots||[])])if(await walk(child))return true;
      return false;
    }
    if(!await walk(root))throw new Error('Missing closed action: '+selector);
  }finally{await client.detach();}
};
