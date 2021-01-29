#!/usr/bin/node --harmony
'use strict';

const fs = require('fs');
const serialport = require('serialport');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')

    .alias('d', 'device')
    .describe('d', 'serial device')

    .alias('f', 'freq')
    .default('f', 1)
    .describe('f', 'frequency of input pulse in Hz')

    .number('baud')
    .alias('b', 'baud')
    .describe('b', 'baudrate (auto-calc from the frequency if not specified)')

    .alias('p', 'period')
    .describe('p', 'counting period in secs')
    .default('p', 3600)

    .number('stop')
    .alias('s', 'stop-after')
    .describe('s', 'stop after n counting periods')

    .option('log')
    .alias('l', 'log')
    .describe('l', 'log to csv file <filename>')

    .count('verbose')
    .alias('v', 'verbose')
    .describe('v', 'verbose')

    .demandOption(['f', 'd'])
    .help('h')
    .epilog('copyright 2029')
    .argv;

const countingPeriod = +argv.period; /* secs  */
const freq = +argv.freq;
const pulsePeriod = 1/freq;
const baud = (! argv.baud) ? calcBaud(freq) : argv.baud;
const maxCountingWindowsNum = argv.s;
var countingTimer = null;
var countingWindowEndTime;
var pulseCnt;
var sofarExpectedPulses = 0;
var sofarMeasuredPulses = 0;
var countingWindowsNum = 0;
var logs = null;

/**
 * The input pulse has duty cycle of 50%. The idea is to let
 * it's low half signal generate a character, hence I split
 * the duration of the low part into 9 parts -- 1 start bit
 * and 8 data bits. Low frequency pulse will yields low
 * baudrate, if the platform does not support such low baudrate,
 * I will choose the next higher baudrate. When the selected
 * baudrate is higher than required, I will received frame error,
 * but it doesn't mamtter for the purpose of counting the pulse.
 */
function calcBaud (freq) {
    const standardBauds = [
        75, 110, 300, 600, 1200, 2400, 4800, 9600, 14400, 19200,
        38400, 57600, 115200, 12800, 256000,
    ];
    var baud = freq * 20;

    for (var i = 0; i < standardBauds.length; ++i) {
        if (standardBauds[i] >= baud) {
            baud = standardBauds[i];
            return baud;
        }
    }
    return -1;
}

function endCountingWindow (t, nPulses) {
    const expectedPulseCnt = countingPeriod * freq;
    const err = nPulses - expectedPulseCnt;

    sofarExpectedPulses += expectedPulseCnt;
    sofarMeasuredPulses += nPulses;
    var sofarErr = sofarMeasuredPulses - sofarExpectedPulses;

    const timestamp = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()} ${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}`;
    const ppm = Math.round(err/expectedPulseCnt * 1000000);
    const ppmSofar = Math.round(sofarErr/sofarExpectedPulses * 1000000);
    console.log(`${timestamp}: ${expectedPulseCnt} ${err} ${ppm} PPM ${sofarExpectedPulses} ${sofarErr} ${ppmSofar} PPM`);
    if (logs)
        logs.write(`${t.valueOf()},${expectedPulseCnt},${err},${ppm}\n`);

    if (maxCountingWindowsNum && ++countingWindowsNum == maxCountingWindowsNum)
        process.exit(0);
}

function startCountingWindow (t) {
    pulseCnt = 0;
    countingWindowEndTime = new Date(t);
    countingWindowEndTime.setMilliseconds(
        countingWindowEndTime.getMilliseconds() + countingPeriod * 1000);
    countingTimer = setTimeout(() => {
        const t = new Date();
        endCountingWindow(t, pulseCnt);
        startCountingWindow(t);
    }, countingWindowEndTime - t);
}

if (baud == -1) {
    console.error('frequency is too high');
    process.exit(1);
}
if (countingPeriod < pulsePeriod) {
    console.error('reporting period too short');
    process.exit(1);
}
if (argv.log) {
    logs = fs.createWriteStream(argv.log);
    logs.write('Time,ExpectedPulses,Error,PPM\n');
}
console.log('use baudrate ' + baud);

const port = new serialport(argv.device, {
    baudRate: baud,
}, err => {
    if (err) {
        console.error(err.message);
        process.exit(0);
    }
});
port.on('data', data => {
    const t = new Date();
    if (! countingTimer) {
        startCountingWindow(t);
        return;
    }
    ++pulseCnt;
});

process.on('SIGINT', () => {
    if (logs) logs.end();
    process.exit(2);
});
