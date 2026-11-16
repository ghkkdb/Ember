const fs = require('fs');
const targetFile = 'd:/Desktop/webGame/泰拉兄弟/terrabrotato.html';
let src = fs.readFileSync(targetFile, 'utf8');

const target = `                if(this.bossWeaponRules(weapon.id)){
                    const p=this.getBossProfile(weapon,st);
                    if(weapon.id==='boss_hammer')return total+(expected(p.main)+(p.wave*2+p.strong)/3)/st.cd;
                    if(weapon.id==='boss_hive')return total+(splitWeaponDamage(p.main,this.selectedCoreId==='volley'?4:2).reduce((n,d)=>n+expected(d),0)+p.extra/(100/p.gain))/st.cd;
                    const main=p.core==='volley'?splitWeaponDamage(p.parts[0],2).reduce((n,d)=>n+expected(d),0):expected(p.parts[0]);
                    return total+(main+Math.round((p.parts[1]+p.parts[2]+p.pulse+p.facet)*p.rate))/st.cd;
                }`;

const replacement = `                if(this.bossWeaponRules(weapon.id)){
                    const p=this.getBossProfile(weapon,st);
                    if(weapon.id==='boss_hammer')return total+(expected(p.main)+(p.wave*2+p.strong)/3)/st.cd;
                    if(weapon.id==='boss_hive')return total+(splitWeaponDamage(p.main,this.selectedCoreId==='volley'?4:2).reduce((n,d)=>n+expected(d),0)+p.extra/(100/p.gain))/st.cd;
                    if(weapon.id==='boss_tank')return total+(expected(p.main)+p.dot)/st.cd;
                    if(weapon.id==='boss_clock')return total+(expected(p.main)+expected(p.delayBeam))/st.cd;
                    if(weapon.id==='boss_train')return total+(expected(p.contact)+expected(p.recall))/st.cd;
                    if(p.parts){
                        const main=p.core==='volley'?splitWeaponDamage(p.parts[0],2).reduce((n,d)=>n+expected(d),0):expected(p.parts[0]);
                        return total+(main+Math.round(((p.parts[1]||0)+(p.parts[2]||0)+(p.pulse||0)+(p.facet||0))*(p.rate||0.5)))/st.cd;
                    }
                    return total+expected(st.dmg)/st.cd;
                }`;

if (!src.includes(target)) {
    console.error('Target not found in terrabrotato.html!');
    process.exit(1);
}

src = src.replace(target, replacement);
fs.writeFileSync(targetFile, src, 'utf8');
console.log('Successfully patched getBuildDpsCeiling in terrabrotato.html!');
