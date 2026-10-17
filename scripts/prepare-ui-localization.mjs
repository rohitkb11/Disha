// One-time source conversion/audit. Uses the installed TypeScript parser, not DOM rewriting.
import ts from "typescript";
import {readFileSync,writeFileSync} from "node:fs";
const files=["components/disha-app.tsx","components/community-page.tsx","components/partner-dialog.tsx","components/shared.tsx"];
const strings=new Set();
for(const file of files){
 const text=readFileSync(file,"utf8"), ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 if(process.argv.includes("--apply") && text.includes('from "./ui-language"')) throw new Error(`${file} already converted; do not apply twice.`);
 function visit(node,component=false){
   const isComponent=ts.isFunctionDeclaration(node)&&node.name&&/^[A-Z]/.test(node.name.text);
   const active=component||isComponent;
   if(isComponent&&node.body) edits.push({start:node.body.getStart()+1,end:node.body.getStart()+1,text:'\nconst ui = useUiText();\n'});
   if(active&&ts.isJsxText(node)){
     const value=node.text.replace(/\s+/g," ").trim();
     if(value&&/[a-zA-Z]/.test(value)){strings.add(value);edits.push({start:node.getFullStart(),end:node.end,text:`{ui(${JSON.stringify(value)})}`});}
   }
   if(active&&ts.isJsxAttribute(node)&&["title","subtitle","eyebrow","detail","label","placeholder","aria-label"].includes(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer)){
     const value=node.initializer.text;if(/[a-zA-Z]/.test(value)){strings.add(value);edits.push({start:node.initializer.getStart(ast),end:node.initializer.end,text:`{ui(${JSON.stringify(value)})}`});}
   }
   ts.forEachChild(node,n=>visit(n,active));
 }
 visit(ast);
 if(process.argv.includes("--apply")){
   let out=text;for(const e of edits.sort((a,b)=>b.start-a.start))out=out.slice(0,e.start)+e.text+out.slice(e.end);
   out=out.replace('"use client";','"use client";\nimport { useUiText } from "./ui-language";');
   writeFileSync(file,out);
 }
}
writeFileSync(".sites-runtime/ui-strings.json",JSON.stringify([...strings].sort(),null,2));
console.log(`${strings.size} interface strings collected. ${process.argv.includes("--apply")?"Sources converted.":"Audit only; source unchanged."}`);
