const fs=require('fs');
const path=require('path');
function walk(d){
 fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{
  const p=path.join(d,e.name);
  if(e.isDirectory() && !p.includes('node_modules') && !p.includes('.next')) walk(p);
  else if(p.endsWith('.ts')||p.endsWith('.tsx')){
   let c=fs.readFileSync(p,'utf8');
   let n=c.replaceAll('@/app/components','@/components').replaceAll('@/app/lib','@/lib');
   if(n!==c){ fs.writeFileSync(p,n); console.log('FIXED '+p) }
  }
 })
}
walk('.')
console.log('DONE');