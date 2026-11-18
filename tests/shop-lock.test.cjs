const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {setup}=require('../analysis/combat-benchmark.cjs');

function shop() {
    const e=setup(47),a=e.app;
    a.recalcStats();a.wave=1;a.state='SHOP';a.shopRerolls=0;a.shopCards=[];a.generateShopCards();
    // 规则测试替代渲染，真实DOM与触屏点击由浏览器验收覆盖。
    a.renderShopUI=()=>{};e.context.currentShop=a;vm.runInContext('app=currentShop',e.context);
    return e;
}

test('锁定与解锁同时改变文字、按钮语义及保留规则，武器和饰品均覆盖',()=>{
    for(const kind of ['weapon','item']){
        const {app:a,context}=shop();
        const card=kind==='weapon'?a.shopCards[0]:{kind:'item',id:'shackle',tier:1,price:10,bought:false,locked:false};
        a.shopCards[0]=card;
        assert.match(a.shopLockStatusHtml(card),/未锁定/);assert.match(a.shopLockButtonHtml(card,0),/aria-pressed="false"/);
        context.window.lockShopCard(0);
        assert.equal(card.locked,true);assert.match(a.shopLockStatusHtml(card),/已锁定/);assert.match(a.shopLockButtonHtml(card,0),/aria-pressed="true"/);assert.match(a.shopLockButtonHtml(card,0),/取消锁定/);
        a.generateShopCards();assert.equal(a.shopCards[0],card);
        a.wave=2;a.generateShopCards();assert.equal(a.shopCards[0],card);
        context.window.lockShopCard(0);assert.equal(card.locked,false);
        a.generateShopCards();assert.notEqual(a.shopCards[0],card);
    }
});

test('购买后、已失效或非商店状态不能再次锁定，异常索引不影响卡片',()=>{
    const {app:a,context}=shop(),card=a.shopCards[0];
    for(const idx of [-1,99,'0',NaN])assert.doesNotThrow(()=>context.window.lockShopCard(idx));
    assert.equal(card.locked,false);
    card.bought=true;context.window.lockShopCard(0);assert.equal(card.locked,false);
    card.bought=false;card.invalid=true;context.window.lockShopCard(0);assert.equal(card.locked,false);
    card.invalid=false;a.state='WAVE';context.window.lockShopCard(0);assert.equal(card.locked,false);
});
