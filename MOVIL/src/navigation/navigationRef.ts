type NavRefLike = {
  current: any;
  isReady: () => boolean;
  navigate: (...args: any[]) => void;
};

export const navigationRef: NavRefLike = {
  current: null,
  isReady() {
    if (!this.current) return false;
    if (typeof this.current.isReady === 'function') return this.current.isReady();
    return true;
  },
  navigate(...args: any[]) {
    if (this.current && typeof this.current.navigate === 'function') {
      this.current.navigate(...args);
    }
  },
};

