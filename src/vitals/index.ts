import type * as playwright from 'playwright';

import { CLS } from './cls.js';
import { FID } from './fid.js';
import { LCP } from './lcp.js';
import { TBT } from './tbt.js';

export { WebVitals, WebVitalsCollector };

class WebVitals {
  public constructor(
    public lcp: number | undefined,
    public cls: number | undefined,
    public fid: number | undefined,
    public tbt: number | undefined,
  ) {}

  public static fromJSON(data: Partial<WebVitals>): WebVitals {
    return new WebVitals(data.lcp as number, data.cls as number, data.fid as number, data.tbt as number);
  }
}

class WebVitalsCollector {
  private constructor(private _lcp: LCP, private _cls: CLS, private _fid: FID, private _tbt: TBT) {}

  public static async create(page: playwright.Page): Promise<WebVitalsCollector> {
    const result = new WebVitalsCollector(new LCP(page), new CLS(page), new FID(page), new TBT(page));
    await result._lcp.setup();
    await result._cls.setup();
    await result._fid.setup();
    await result._tbt.setup();
    return result;
  }

  public async collect(): Promise<WebVitals> {
    return new WebVitals(
      await this._lcp.collect(),
      await this._cls.collect(),
      await this._fid.collect(),
      await this._tbt.collect(),
    );
  }
}
