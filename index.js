const https = require('https');
const core = require('@actions/core');
const github = require('@actions/github');

// parse github ref to get PR number
const refRegexp = /\w+?\/\w+?\/(\d+?)\//;
const regexResult = refRegexp.exec(github.context.ref);
const prNumber = regexResult[1];
console.log(`Running on ${prNumber}`)

if (prNumber === null) {
    console.log("Let this workflow run.");
    process.exit(0);
}

const httpPrOptions = {
    hostname: 'api.github.com',
    path: `/repos/${process.env.GITHUB_REPOSITORY}/pulls/${prNumber}`,
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'actions/cancel-multi-action'
    },
    method: 'GET',
    json: true
}

const prReq = https.request(httpPrOptions, (prRes) => {
    let chunks = [];

    prRes.on('data', (data) => {
        chunks.push(data);
    });

    prRes.on('end', () => {
        let data = Buffer.concat(chunks);
        let parsed = JSON.parse(data);

        if (prRes.statusCode != 200) {
            console.log(`Error (${prRes.statusCode}): ${parsed.message}`);
            process.exit(1);
        } else if (parsed.head.label.startsWith('OpenFactorioServerManager')) {
            const httpCancelOptions = {
                hostname: 'api.github.com',
                path: `/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/cancel`,
                headers: {
                    'Authorization': `token ${core.getInput('token')}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'actions/cancel-action'
                },
                method: 'POST'
            }

            const cancelReq = https.request(httpCancelOptions, (cancelRes) => {
                cancelRes.on('data', (data) => {
                    if (cancelRes.statusCode != 202) {
                        let parsed = JSON.parse(data)
                        console.log(`Error (${cancelRes.statusCode}): ${parsed.message}`)
                        process.exit(1)
                    } else {
                        console.log('Cancelled successfully.')
                        process.exit(0)
                    }
                })
            })

            cancelReq.on('error', (error) => {
                console.log(`HTTP Error: ${error}`)
                process.exit(1)
            })

            cancelReq.end();
        } else {
            console.log('Let the tests run!');
        }
    })
})

prReq.on('error', (error) => {
    console.log(`prHttp Error: ${error}`)
    process.exit(1)
})

prReq.end();
