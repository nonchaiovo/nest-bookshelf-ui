import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('./bookshelf.jsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function readerTextRects'), source.indexOf('function ReaderView'));
const offsetAt = vm.runInNewContext(helpers + '\nreaderOffsetAtPosition');
test('finds the first character of a page inside a long paragraph', () => {
  const rects={length:10000, at:i=>({left:22+Math.floor(i/180)*410,bottom:30})};
  assert.equal(offsetAt(rects,{left:22,top:0},7,false,410),1260);
  assert.equal(offsetAt(rects,{left:22,top:0},0,false,410),0);
});
test('scroll anchors select the first visible line, including a partly visible line', () => {
  const rects={length:1000,at:i=>({left:0,bottom:Math.floor(i/20)*32+30})};
  assert.equal(offsetAt(rects,{left:0,top:0},65,true,600),40);
  assert.equal(offsetAt(rects,{left:0,top:0},29,true,600),20);
});
function gestures(isScroll=false) {
  const turns=[], readingTapRef={current:{moved:false}}, touchRef={current:null};
  const code=source.slice(source.indexOf('  const touchRef ='),source.indexOf('  const needsLoad',source.indexOf('  const touchRef =')));
  const f=vm.runInNewContext(`(()=>{${code};return {onTouchStart,onTouchMove,onTouchEnd,cancelTouchTurn};})()`,{
    React:{useRef:()=>touchRef},readingTapRef,isScroll,window:{getSelection:()=>null},Date,turn:d=>turns.push(d)
  });
  const t=(identifier,clientX,clientY=200)=>({identifier,clientX,clientY});
  const event=(touches,changedTouches=touches)=>({touches,changedTouches});
  return {...f,turns,readingTapRef,t,event};
}
test('one-finger swipe turns once; vertical motion does not turn', () => {
  const f=gestures();
  f.onTouchStart(f.event([f.t(1,250)]));f.onTouchEnd(f.event([],[f.t(1,140)]));
  assert.deepEqual(f.turns,[1]);assert.equal(f.readingTapRef.current.moved,true);
  f.onTouchStart(f.event([f.t(2,250)]));f.onTouchEnd(f.event([],[f.t(2,230,500)]));
  assert.deepEqual(f.turns,[1]);
});
test('pinch followed by staggered finger lifts never turns', () => {
  const f=gestures();
  f.onTouchStart(f.event([f.t(1,250)]));
  f.onTouchStart(f.event([f.t(1,250),f.t(2,280)]));
  f.onTouchMove(f.event([f.t(1,100),f.t(2,350)]));
  f.onTouchEnd(f.event([f.t(2,350)],[f.t(1,100)]));
  f.onTouchEnd(f.event([],[f.t(2,350)]));
  assert.deepEqual(f.turns,[]);assert.equal(f.readingTapRef.current.moved,true);
});
test('cancelled or mismatched touch cannot finish a page turn', () => {
  const f=gestures();
  f.onTouchStart(f.event([f.t(1,250)]));f.cancelTouchTurn();f.onTouchEnd(f.event([],[f.t(1,100)]));
  f.onTouchStart(f.event([f.t(1,250)]));f.onTouchEnd(f.event([],[f.t(2,100)]));
  assert.deepEqual(f.turns,[]);
});
test('a normal blank-space tap remains available in scroll mode', () => {
  const f=gestures(true);f.onTouchStart(f.event([f.t(1,250)]));f.onTouchEnd(f.event([],[f.t(1,250)]));
  assert.equal(f.readingTapRef.current.moved,false);assert.deepEqual(f.turns,[]);
});
