class Core {
  setFailed(message: string) {
    throw new Error(message);
  }
  error(message: string | Error) {
    console.error(message);
  }
  info(message: string): void {
    // console.info(message);
  }
  debug(message: string) {
    console.debug(message);
  }
  warning(message: string | Error) {
    console.warn(message);
  }
}

export const core = new Core();
