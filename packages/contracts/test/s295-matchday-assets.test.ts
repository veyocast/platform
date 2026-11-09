import {expect,it} from 'vitest';
import {collectSyncSportMediaAssetIds} from '../src/index';

it('collects new pool result logos with existing own result, standing and programme assets',()=>{
 const own='10000000-0000-4000-8000-000000000295',poolHome='20000000-0000-4000-8000-000000000295',poolAway='30000000-0000-4000-8000-000000000295';
 const data={sport:{matchday:{results:{items:[{homeLogoMediaAssetId:own}]},poolResults:{items:[{homeLogoMediaAssetId:poolHome,awayLogoMediaAssetId:poolAway},{homeLogoMediaAssetId:own},{homeLogoMediaAssetId:'provider-secret-is-not-an-asset'}]},standings:{items:[{logoMediaAssetId:own}]},fixtures:{items:[{awayLogoMediaAssetId:own}]}}}};
 expect(collectSyncSportMediaAssetIds(data)).toEqual([own,poolHome,poolAway]);
 expect(collectSyncSportMediaAssetIds({sport:{matchday:{results:{items:[{homeLogoMediaAssetId:own}]}}}})).toEqual([own]);
});
