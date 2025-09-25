export default class CustomFetchError extends Error {
  public readonly status: number;
  public readonly response?: any;

  constructor(status: number, response?: any, message?: string) {
    super(message);
    this.status = status;
    this.response = response;
    this.name = "CustomFetchError";
    Object.setPrototypeOf(this, CustomFetchError.prototype);
  }
}
