#!/usr/bin/node --harmony
'use strict';

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
    .alias('p', 'period')
    .describe('p', 'reporting period in secs')
    .default('p', 1800)
    .demandOption(['f', 'd'])
    .help('h')
    .epilog('copyright 2029')
    .argv;

const reportingPeriod = +argv.period; /* seconds  */
const freq = +argv.freq;
const baud = calcBaud(freq);
var started = false;
var pulseCnt;
var lastPulseTime;

/**
 * The input pulse has duty cycle of 50%. The idea is to let
 * it's high half signal generate a character, hence I split
 * the duration of the high part into 9 parts -- 1 start bit
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
    const duration = 1/freq/2;
    const bitTime = duration/9;
    var baud = Math.ceil(1/bitTime);

    for (var i = 0; i < standardBauds.length; ++i) {
        if (standardBauds[i] >= baud) {
            baud = standardBauds[i];
            return baud;
        }
    }
    return -1;
}

function scheduleReporting () {
    const expectedPulseCnt = reportingPeriod * freq;
    const windowTime = expectedPulseCnt * (1/freq) + (.6/freq);
    const reportingTime = lastPulseTime.setMilliseconds(
        lastPulseTime.getMilliseconds() + windowTime * 1000);
    setTimeout(reporting, reportingTime - new Date());
}

function reporting () {
    const expectedPulseCnt = reportingPeriod * freq;
    const err = pulseCnt - expectedPulseCnt;
    const now = new Date();
    pulseCnt = 0;
    scheduleReporting();
    const timeStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    console.log(`\n${timeStr}: ${err}/${expectedPulseCnt} ${err/expectedPulseCnt * 1000000} PPM`);
}

if (baud == -1) {
    console.error('frequency is too high');
    process.exit(1);
}
if (reportingPeriod < 1/freq) {
    console.error('reporting period too short');
    process.exit(1);
}
console.log('baudrate ' + baud);

const port = new serialport(argv.device, {
    baudRate: baud,
}, err => {
    if (err) {
        console.error(err.message);
        process.exit(0);
    }
});
port.on('data', data => {
    lastPulseTime = new Date();
    if (! started) {
        scheduleReporting();
        started = true;
        pulseCnt = 0;
        console.log('start counting');
    } else {
        ++pulseCnt;
        if (! (pulseCnt % 600))
            process.stdout.write('+\n');
        else if (! (pulseCnt % 60))
            process.stdout.write('+');
        else if (! (pulseCnt % 10))
            process.stdout.write('.');
    }
});
