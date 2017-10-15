'use strict';

const github = require('../github/client');
const constants = require('./constants');
const _ = require('lodash');
const contentTesters = require('./content_testers');

function collectTesters(file) {
    if (!file.patch) {
        return [];
    }
    return contentTesters.collectTesters(file.filename);
}

function containsCredentialRelatedInfo(file) {
    const testers = collectTesters(file);
    return testers.some(tester => tester.test(file.patch));
}

async function validateCommit(commit) {
    const files = await commit.getFiles();
    return files
        .filter(containsCredentialRelatedInfo)
        .map(file => new CommittedFile(file, commit));
}

class CommittedFile {
    constructor(file, commit) {
        this.path = file.filename;
        this.status = file.status;
        this.rawUrl = file['raw_url'];
        this.patch = file.patch;
        this.commit = {
            sha: commit.sha,
            date: commit.commit.author.date,
            author: {
                name: commit.commit.author.name,
                email: commit.commit.author.email
            }
        };
    }
}

/**
 * @param params {
 *      user: user name
 *      repo: repository name
 * }
 */
module.exports.searchByCommits = async params => {
    const promises = constants.SECRET_KEYWORDS.map(async keyword => {
        const commitResponse = await github.commits.searchByMessage(keyword, params);
        return await Promise.all(commitResponse.map(validateCommit));
    });
    const results = await Promise.all(promises);
    return _.flatten(_.flatten(results).filter(result => !_.isEmpty(result)));
};