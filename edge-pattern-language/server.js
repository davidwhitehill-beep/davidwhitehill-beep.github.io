const express=require('express');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const app=express();
const PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,'patterns.json');
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
function read(){if(!fs.existsSync(DATA)) return []; return JSON.parse(fs.readFileSync(DATA,'utf8'));}
function write(d){fs.writeFileSync(DATA,JSON.stringify(d,null,2));}
app.get('/api/patterns',(req,res)=>res.json(read()));
app.post('/api/patterns',(req,res)=>{const p=read(); const item={id:crypto.randomUUID(),createdAt:new Date().toISOString(),...req.body}; p.push(item); write(p); res.json(item);});
app.delete('/api/patterns/:id',(req,res)=>{write(read().filter(x=>x.id!==req.params.id)); res.json({ok:true});});
app.listen(PORT,()=>console.log('running on '+PORT));