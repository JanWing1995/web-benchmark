import { filesize } from 'filesize';

import { JsonStringify } from '../util/json.js';
import type { AnalyticsFunction, NumberProvider } from './metrics-stats.js';
import { MetricsStats } from './metrics-stats.js';
import type { Result } from './result.js';
import type { ResultsSet } from './results-set.js';

// Compares latest result to previous/baseline results and produces the needed info.

export class ResultsAnalyzer {
  private constructor(private _result: Result) {}

  /**
   *
   */
  public static async analyze(currentResult: Result, baselineResults?: ResultsSet): Promise<Analysis> {
    const items = new ResultsAnalyzer(currentResult)._collect();

    const baseline = baselineResults?.find(
      other =>
        other.cpuThrottling == currentResult.cpuThrottling &&
        other.name == currentResult.name &&
        other.networkConditions == currentResult.networkConditions &&
        JsonStringify(other) != JsonStringify(currentResult),
    );

    if (baseline != undefined) {
      const baseItems = new ResultsAnalyzer(baseline[0])._collect();
      // update items with baseline results
      for (const base of baseItems) {
        for (const item of items) {
          if (item.metric == base.metric) {
            item.others = base.values;
          }
        }
      }
    }

    return {
      items: items,
    };
  }

  /**
   *
   */
  private _collect(): AnalyzerItem[] {
    const items = new Array<AnalyzerItem>();

    const scenarioResults = this._result.scenarioResults;

    const pushIfDefined = function (
      metric: AnalyzerItemMetric | any,
      unit: AnalyzerItemUnit,
      source: NumberProvider,
      fn: AnalyticsFunction,
    ): void {
      const values = scenarioResults.map(items => fn(items, source));
      // only push if at least one value is defined
      if (values.findIndex(v => v != undefined) >= 0) {
        items.push({
          metric: metric,
          values: new AnalyzerItemNumberValues(unit, values),
        });
      }
    };

    pushIfDefined('lcp', AnalyzerItemUnit.ms, MetricsStats.lcp, MetricsStats.mean);
    // pushIfDefined('lcp (median)', AnalyzerItemUnit.ms, MetricsStats.lcp, MetricsStats.median);
    // pushIfDefined('lcp (stddev)', AnalyzerItemUnit.ms, MetricsStats.lcp, MetricsStats.stddev);
    pushIfDefined(AnalyzerItemMetric.cls, AnalyzerItemUnit.ms, MetricsStats.cls, MetricsStats.mean);
    pushIfDefined(AnalyzerItemMetric.fid, AnalyzerItemUnit.ms, MetricsStats.fid, MetricsStats.mean);
    pushIfDefined(AnalyzerItemMetric.tbt, AnalyzerItemUnit.ms, MetricsStats.tbt, MetricsStats.mean);
    pushIfDefined(AnalyzerItemMetric.cpu, AnalyzerItemUnit.ratio, MetricsStats.cpu, MetricsStats.mean);
    pushIfDefined(AnalyzerItemMetric.memoryAvg, AnalyzerItemUnit.bytes, MetricsStats.memoryMean, MetricsStats.mean);
    pushIfDefined(AnalyzerItemMetric.memoryMax, AnalyzerItemUnit.bytes, MetricsStats.memoryMax, MetricsStats.max);
    pushIfDefined(AnalyzerItemMetric.netTx, AnalyzerItemUnit.bytes, MetricsStats.netTx, MetricsStats.mean);
    pushIfDefined(AnalyzerItemMetric.netRx, AnalyzerItemUnit.bytes, MetricsStats.netRx, MetricsStats.mean);

    return items;
  }
}

export enum AnalyzerItemUnit {
  ms,
  ratio, // 1.0 == 100 %
  bytes,
  integer,
}

export interface AnalyzerItemValues {
  value(index: number): string;
  diff(aIndex: number, bIndex: number): string;
  percent(aIndex: number, bIndex: number): string;
}

const AnalyzerItemValueNotAvailable = 'n/a';

class AnalyzerItemNumberValues implements AnalyzerItemValues {
  public constructor(private _unit: AnalyzerItemUnit, private _values: (number | undefined)[]) {}

  public value(index: number): string {
    if (!this._has(index)) return AnalyzerItemValueNotAvailable;
    return this._withUnit(this._get(index));
  }

  public diff(aIndex: number, bIndex: number): string {
    if (!this._has(aIndex) || !this._has(bIndex)) return AnalyzerItemValueNotAvailable;
    const diff = this._get(bIndex) - this._get(aIndex);
    const str = this._withUnit(diff, true);
    return diff > 0 ? `+${str}` : str;
  }

  public percent(aIndex: number, bIndex: number): string {
    if (!this._has(aIndex) || !this._has(bIndex) || this._get(aIndex) == 0.0) return AnalyzerItemValueNotAvailable;
    const percent = (this._get(bIndex) / this._get(aIndex)) * 100 - 100;
    const str = `${percent.toFixed(2)} %`;
    return percent > 0 ? `+${str}` : str;
  }

  private _has(index: number): boolean {
    return index >= 0 && index < this._values.length && this._values[index] != undefined;
  }

  private _get(index: number): number {
    return this._values[index]!;
  }

  private _withUnit(value: number, isDiff: boolean = false): string {
    switch (this._unit) {
      case AnalyzerItemUnit.bytes:
        return filesize(value) as string;
      case AnalyzerItemUnit.ratio:
        return `${(value * 100).toFixed(2)} ${isDiff ? 'pp' : '%'}`;
      case AnalyzerItemUnit.integer:
        return `${value}`;
      default:
        return `${value.toFixed(2)} ${AnalyzerItemUnit[this._unit]}`;
    }
  }
}

export enum AnalyzerItemMetric {
  lcp,
  cls,
  fid,
  tbt,
  cpu,
  memoryAvg,
  memoryMax,
  netTx,
  netRx,
  netCount,
  netTime,
}

export interface AnalyzerItem {
  metric: AnalyzerItemMetric;

  // Current (latest) result.
  values: AnalyzerItemValues;

  // Previous or baseline results, depending on the context.
  others?: AnalyzerItemValues;
}

export interface Analysis {
  items: AnalyzerItem[];
}
