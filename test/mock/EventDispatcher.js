export default class EventDispatcher {
  dispatch(event) {
    this.lastEvent = event;
    return event;
  }
}
