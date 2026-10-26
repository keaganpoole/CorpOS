import fs from 'node:fs/promises';
const {rows}=JSON.parse(await fs.readFile('src/catalog.json','utf8'));
for(const id of [12,8,3,7]) {
 const person=rows.find(p=>p.id===id),dest=`public/videos/${id}-source.mp4`;
 try{await fs.access(dest);continue;}catch{}
 const res=await fetch(person.avatar_video_source.replace(/%0D|%0A/gi,''));
 if(!res.ok)throw new Error(`${person.first_name}: ${res.status}`);
 await fs.writeFile(dest,new Uint8Array(await res.arrayBuffer()));
 console.log(`${person.first_name}: downloaded exact catalog video.`);
}
