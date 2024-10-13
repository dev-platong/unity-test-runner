import * as fs from 'fs';
import * as xmljs from 'xml-js';
import { RunMeta, TestMeta } from './results-meta';
import path from 'path';
import { core } from '../core';

const ResultsParser = {
  async parseResults(filepath): Promise<RunMeta> {
    if (!fs.existsSync(filepath)) {
      throw new Error(`Missing file! {"filepath": "${filepath}"}`);
    }

    core.info(`Trying to open ${filepath}`);
    const file = await fs.promises.readFile(filepath, 'utf8');
    const results = xmljs.xml2js(file, { compact: true });
    core.info(`File ${filepath} parsed...`);

    return ResultsParser.convertResults(path.basename(filepath), results);
  },

  convertResults(filename, filedata): RunMeta {
    core.info(`Start analyzing results: ${filename}`);

    const run = filedata['test-run'];
    const runMeta = new RunMeta(filename);
    const tests = ResultsParser.convertSuite(run['test-suite']);

    runMeta.total = Number(run._attributes.total);
    runMeta.failed = Number(run._attributes.failed);
    runMeta.skipped = Number(run._attributes.skipped);
    runMeta.passed = Number(run._attributes.passed);
    runMeta.duration = Number(run._attributes.duration);
    runMeta.addTests(tests);

    return runMeta;
  },

  convertSuite(suites) {
    if (Array.isArray(suites)) {
      const innerResult: TestMeta[] = [];
      for (const suite of suites) {
        innerResult.push(...ResultsParser.convertSuite(suite));
      }
      return innerResult;
    }

    const result: TestMeta[] = [];
    const innerSuite = suites['test-suite'];
    if (innerSuite) {
      result.push(...ResultsParser.convertSuite(innerSuite));
    }

    const tests = suites['test-case'];
    if (tests) {
      result.push(...ResultsParser.convertTests(suites._attributes.fullname, tests));
    }

    return result;
  },

  convertTests(suite, tests): TestMeta[] {
    if (Array.isArray(tests)) {
      const result: TestMeta[] = [];
      for (const testCase of tests) {
        result.push(ResultsParser.convertTestCase(suite, testCase));
      }
      return result;
    }

    return [ResultsParser.convertTestCase(suite, tests)];
  },

  convertTestCase(suite, testCase): TestMeta {
    const { _attributes, failure, output } = testCase;
    const { name, fullname, result, duration } = _attributes;
    const testMeta = new TestMeta(suite, name);
    testMeta.result = result;
    testMeta.duration = Number(duration);

    if (!failure) {
      return testMeta;
    }

    if (failure['stack-trace'] === undefined) {
      core.warning(`No stack trace for test case: ${fullname}`);
      return testMeta;
    }

    const trace = failure['stack-trace']._cdata;
    if (trace === undefined) {
      core.warning(`No cdata in stack trace for test case: ${fullname}`);
      return testMeta;
    }
    const point = ResultsParser.findAnnotationPoint(trace);
    if (!point.path || !point.line) {
      core.warning(`Not able to find annotation point for failed test! Test trace: ${trace}`);
      return testMeta;
    }

    const rawDetails = [trace];

    if (output && output._cdata) {
      rawDetails.unshift(output._cdata);
    }

    testMeta.annotation = {
      path: point.path,
      start_line: point.line,
      end_line: point.line,
      annotation_level: 'failure',
      title: fullname,
      message: failure.message._cdata ? failure.message._cdata : 'Test Failed!',
      raw_details: rawDetails.join('\n'),
      start_column: 0,
      end_column: 0,
      blob_href: '',
    };
    core.info(
      `- ${testMeta.annotation.path}:${testMeta.annotation.start_line} - ${testMeta.annotation.title}`,
    );
    return testMeta;
  },

  findAnnotationPoint(trace) {
    const regex = /at(?: .* in)? ((?<path>[^:]+):(?<line>\d+))/;
    // Find first entry with non-zero line number in stack trace
    const items = trace.match(new RegExp(regex, 'g'));
    if (Array.isArray(items)) {
      const result: { path: any; line: number }[] = [];
      for (const item of items) {
        const match = item.match(regex);
        const point = {
          path: match ? match.groups.path : '',
          line: match ? Number(match.groups.line) : 0,
        };
        if (point.line > 0) {
          result.push(point);
        }
      }
      if (result.length > 0) {
        return result[0];
      }
    }
    // If all entries have zero line number match fallback pattern
    const match = trace.match(regex);
    return {
      path: match ? match.groups.path : '',
      line: match ? Number(match.groups.line) : 0,
    };
  },
};

export default ResultsParser;
