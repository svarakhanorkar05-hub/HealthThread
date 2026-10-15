import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeCycleHistory,
  dateOnlyToLocalDate,
  getAgeFromDateOfBirth,
  getCycleEducation,
  isValidDateOnly,
  localDateToDateOnly,
  validatePeriodDates,
} from '../src/lib/menstrual.ts';

function period(start, end = null, id) {
  return { id, period_start: start, period_end: end };
}

test('date-only parsing rejects impossible dates and round-trips leap days', () => {
  assert.equal(isValidDateOnly('2024-02-29'), true);
  assert.equal(isValidDateOnly('2025-02-29'), false);
  assert.equal(isValidDateOnly('2025-13-01'), false);
  assert.equal(isValidDateOnly('2025-1-01'), false);

  const leapDay = dateOnlyToLocalDate('2024-02-29');
  assert.ok(leapDay);
  assert.equal(localDateToDateOnly(leapDay), '2024-02-29');
});

test('age calculation accounts for birthdays and invalid or future birth dates', () => {
  assert.equal(getAgeFromDateOfBirth('2010-10-15', new Date(2026, 9, 14)), 15);
  assert.equal(getAgeFromDateOfBirth('2010-10-14', new Date(2026, 9, 14)), 16);
  assert.equal(getAgeFromDateOfBirth('2030-01-01', new Date(2026, 9, 14)), null);
  assert.equal(getAgeFromDateOfBirth('not-a-date', new Date(2026, 9, 14)), null);
});

test('one or two period starts do not produce a prediction', () => {
  const one = analyzeCycleHistory([period('2026-01-01')], '2026-02-01', 28);
  assert.equal(one.predictionStart, null);
  assert.equal(one.avgCycleLength, null);

  const two = analyzeCycleHistory([
    period('2026-01-01'),
    period('2026-01-29'),
  ], '2026-02-01', 28);
  assert.equal(two.predictionStart, null);
  assert.equal(two.avgCycleLength, 28);
});

test('regular cycles show a conservative estimate window from recent intervals', () => {
  const summary = analyzeCycleHistory([
    period('2026-01-01', '2026-01-05'),
    period('2026-01-29', '2026-02-02'),
    period('2026-02-26', '2026-03-02'),
    period('2026-03-26'),
  ], '2026-03-26', 30);

  assert.deepEqual(summary.cycleLengths, [28, 28, 28]);
  assert.equal(summary.avgCycleLength, 28);
  assert.equal(summary.avgPeriodLength, 5);
  assert.equal(summary.predictionStart, '2026-04-21');
  assert.equal(summary.predictionEnd, '2026-04-25');
  assert.equal(summary.predictionReliability, 'more-reliable');
});

test('irregular cycles retain a transparent observed-range estimate with limited reliability', () => {
  const summary = analyzeCycleHistory([
    period('2026-01-01'),
    period('2026-01-25'),
    period('2026-02-26'),
  ], '2026-02-26', 30);

  assert.equal(summary.irregular, true);
  assert.equal(summary.predictionStart, '2026-03-22');
  assert.equal(summary.predictionEnd, '2026-03-30');
  assert.equal(summary.predictionReliability, 'limited');
});

test('out-of-range intervals are flagged and do not create misleading predictions', () => {
  const shortAdultCycle = analyzeCycleHistory([
    period('2026-01-01'),
    period('2026-01-19'),
    period('2026-02-06'),
  ], '2026-02-06', 25);
  assert.equal(shortAdultCycle.irregular, true);
  assert.equal(shortAdultCycle.predictionStart, null);

  const longTeenCycle = analyzeCycleHistory([
    period('2026-01-01'),
    period('2026-02-20'),
    period('2026-04-11'),
  ], '2026-04-11', 16);
  assert.equal(longTeenCycle.irregular, true);
  assert.equal(longTeenCycle.predictionStart, null);
});

test('duplicate, malformed, and future starts cannot distort cycle estimates', () => {
  const summary = analyzeCycleHistory([
    period('2026-01-01'),
    period('2026-01-01'),
    period('not-a-date'),
    period('2026-01-29'),
    period('2026-03-01'),
    period('2026-06-01'),
  ], '2026-03-01', 30);

  assert.equal(summary.totalCycles, 3);
  assert.deepEqual(summary.cycleLengths, [28, 31]);
  assert.equal(summary.predictionStart, '2026-03-29');
  assert.equal(summary.predictionEnd, '2026-04-02');
  assert.equal(summary.predictionReliability, 'limited');
});

test('period date validation checks invalid, future, reversed, overlapping and adjacent dates', () => {
  const existing = [period('2026-01-10', '2026-01-14', 'old')];
  assert.match(validatePeriodDates('2026-02-30', '', existing, '2026-02-28'), /valid/);
  assert.match(validatePeriodDates('2026-03-01', '', existing, '2026-02-28'), /future/);
  assert.match(validatePeriodDates('2026-02-27', '2026-03-01', existing, '2026-02-28'), /future/);
  assert.match(validatePeriodDates('2026-01-15', '2026-01-14', existing, '2026-02-28'), /before/);
  assert.match(validatePeriodDates('2026-01-14', '', existing, '2026-02-28'), /overlap/);
  assert.match(validatePeriodDates('2026-01-09', '2026-01-11', existing, '2026-02-28'), /overlap/);
  assert.equal(validatePeriodDates('2026-01-15', '', existing, '2026-02-28'), null);
  assert.equal(validatePeriodDates('2026-01-11', '2026-01-12', existing, '2026-02-28', 'old'), null);
});

test('an open-ended period overlaps only its logged start date', () => {
  const existing = [period('2026-02-01', null, 'open')];
  assert.match(validatePeriodDates('2026-02-01', '', existing, '2026-02-28'), /overlap/);
  assert.equal(validatePeriodDates('2026-02-02', '', existing, '2026-02-28'), null);
});

test('age-appropriate education avoids adult cycle ranges for minors', () => {
  const teenEducation = getCycleEducation(15);
  assert.match(teenEducation.heading, /new/i);
  assert.match(teenEducation.guidance, /trusted adult/i);
  assert.doesNotMatch(teenEducation.summary, /21.?35/);

  const adultEducation = getCycleEducation(30);
  assert.match(adultEducation.summary, /21–35/);
  assert.match(getCycleEducation(null).heading, /vary/i);
});
