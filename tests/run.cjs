const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {playwrightModule,browserPath}=require('./runtime.cjs');
function run(name,extra={}){
  const result=spawnSync(process.execPath,[path.join(__dirname,name)],{cwd:path.join(__dirname,'..'),stdio:'inherit',env:{...process.env,PLAYWRIGHT_MODULE_PATH:playwrightModule,...(browserPath?{EDGE_EXECUTABLE:browserPath}:{}),...extra}});
  if(result.status!==0)process.exit(result.status||1);
}
for(const name of ['release-regression.cjs','theme-regression.cjs','friend-regression.cjs','reliability-regression.cjs'])run(name);
for(const theme of ['zen','playful','friend']){
  console.log(`Functional regression: ${theme}`);
  run('native-login.cjs',{FOCUS_TEST_THEME:theme});
  run('floating-toolbar.cjs',{FOCUS_TEST_THEME:theme});
}
