/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import Button from '../src/components/Button';

test('Button 이 라벨을 렌더링한다', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Button label="확인" onPress={() => {}} />);
  });
  expect(JSON.stringify(tree?.toJSON())).toContain('확인');
});
