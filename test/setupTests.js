import '@testing-library/jest-dom/extend-expect';

// Minimal DOM helpers: create a mock for Image() that sets naturalWidth/Height when src is data URL
const RealImage = global.Image;
class MockImage {
  constructor(){
    this.onload = null; this.onerror = null; this.crossOrigin = null;
    this._src = '';
    this.naturalWidth = 0; this.naturalHeight = 0;
  }
  set src(v){
    this._src = v;
    // If it's a data URL, simulate load with small dimensions
    if(typeof v === 'string' && v.startsWith('data:')){
      this.naturalWidth = 200; this.naturalHeight = 200;
      if(typeof this.onload === 'function') setTimeout(()=>this.onload(), 0);
    } else {
      // simulate error for non-data URLs in tests
      if(typeof this.onerror === 'function') setTimeout(()=>this.onerror(new Error('mock load error')), 0);
    }
  }
  get src(){ return this._src; }
}

global.Image = MockImage;
