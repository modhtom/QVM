export const VideoState = {
  _data: null,
  set(data) {
    this._data = { ...data };
    console.log('State Updated:', this._data);
  },
  get() {
    if (!this._data) {
      console.warn('State accessed but data is empty');
      return null;
    }
    return { ...this._data };
  },
  clear() {
    this._data = null;
    console.log('State Cleared');
  }
};
