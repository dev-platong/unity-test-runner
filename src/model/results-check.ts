import * as fs from 'fs';
import Handlebars from 'handlebars';
import ResultsParser from './results-parser';
import { RunMeta } from './results-meta';
import { core } from '../core';

const ResultsCheck = {
  async createCheck(artifactPath: string) {
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Missing input! "artifactPath": "${artifactPath}"`);
    }

    const runs: RunMeta[] = [];
    core.info(`Processing file ${artifactPath}...`);
    const fileData = await ResultsParser.parseResults(artifactPath);
    runs.push(fileData);

    // Combine all results into a single run summary
    const runSummary = new RunMeta('checkName');
    for (const run of runs) {
      runSummary.total += run.total;
      runSummary.passed += run.passed;
      runSummary.skipped += run.skipped;
      runSummary.failed += run.failed;
      runSummary.duration += run.duration;
      for (const suite of run.suites) {
        runSummary.addTests(suite.tests);
      }
    }

    // Log
    core.info('=================');
    core.info('Analyze result:');
    core.info(runSummary.summary);

    // Format output
    const title = runSummary.summary;
    const summary = await ResultsCheck.renderSummary(runs);
    core.debug(`Summary view: ${summary}`);
    const details = await ResultsCheck.renderDetails(runs);
    core.debug(`Details view: ${details}`);
    const rawAnnotations = runSummary.extractAnnotations();
    const annotations = rawAnnotations.map(rawAnnotation => {
      const annotation = rawAnnotation;
      annotation.path = rawAnnotation.path.replace('/github/workspace/', '');
      return annotation;
    });
    const output = {
      title,
      summary,
      text: details,
      annotations: annotations.slice(0, 50),
    };

    return runSummary.failed;
  },

  async renderSummary(runMetas) {
    return ResultsCheck.render(`${__dirname}/results-check-summary.hbs`, runMetas);
  },

  async renderDetails(runMetas) {
    return ResultsCheck.render(`${__dirname}/results-check-details.hbs`, runMetas);
  },

  async render(viewPath, runMetas) {
    Handlebars.registerHelper('indent', toIndent =>
      toIndent
        .split('\n')
        .map(s => `        ${s.replace('/github/workspace/', '')}`)
        .join('\n'),
    );
    const source = await fs.promises.readFile(viewPath, 'utf8');
    const template = Handlebars.compile(source);
    return template(
      { runs: runMetas },
      {
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true,
      },
    );
  },
};

export default ResultsCheck;
