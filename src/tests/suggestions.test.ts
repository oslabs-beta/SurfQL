// You can import and use all API from the 'vscode' module
// import * as myExtension from '../../extension';

import * as surfql from '../lib/suggestions';

describe('Unit tests', () => {
	it('Fix bad formatting', () => {
		const historyArray = ['query', '{', 'pokemon(', 'id', '151){', 'name', 'moves', '}}'];
		const formattedHistoryArray = surfql.fixBadHistoryFormatting(historyArray);
		expect(formattedHistoryArray).toEqual(['query', '{', 'pokemon', '(', 'id', '151', ')', '{', 'name', 'moves', '}', '}']);
	});
});
