import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as OneTimePresignedUrl from '../lib/one-time-presigned-url-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new OneTimePresignedUrl.OneTimePresignedUrlStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
