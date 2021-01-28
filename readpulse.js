#!/usr/bin/node --harmony
'use strict';

/* Input pulse frequency is 1Hz. Using serial port with a low baud rate to read
 * it, each pulse will resulted
 * in one character reading from the serial port.
 */

const serialport = require('serialport');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .alias('d', 'device')
    .describe('d', 'serial device')
    .alias('b', 'baudrate')
    .describe('b', 'baudrate')
    .default('b', 110)
    .alias('p', 'period')
    .describe('p', 'reporting period in secs')
    .default('p', 1800)
    .demandOption(['d'])
    .help('h')
    .epilog('copyright 2029')
    .argv;

/* Period is in seconds. Since frequency is 1Hz, hence period number is also the
 * expected pulse number.
 */
const reportingPeriod = +argv.period;
var started = false;
var pulseCnt;
var lastPulseTime;

function scheduleReporting () {
    const reportingTime = lastPulseTime.setMilliseconds(
        lastPulseTime.getMilliseconds() + reportingPeriod * 1000 + 500);
    setTimeout(reporting, reportingTime - new Date());
}

function reporting () {
    const err = pulseCnt - reportingPeriod;
    const now = new Date();
    pulseCnt = 0;
    scheduleReporting();
    const timeStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    console.log(`\n${timeStr}: ${err}/${reportingPeriod} ${err/reportingPeriod * 1000000} PPM`);
}

const port = new serialport(argv.device, {
    baudRate: +argv.baud,
}, err => {
    if (err) {
        console.error('cannot open the port');
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

