import{describe,it,expect}from'vitest';
import{syncPreviewFailure}from'./sync-preview-diagnostic';
describe('read-only source diagnostics',()=>{
 it('only recommends narrowing the selection for an actual bound failure',()=>{
  expect(syncPreviewFailure('projector','SYNC_PRESENTATION_BOUNDS_EXCEEDED','fixture').error).toContain('Beperk de selectie');
  for(const code of ['SYNC_CANONICAL_FRESHNESS_INVALID','SYNC_CANONICAL_IDENTITY_INVALID','SYNC_SNAPSHOT_INVALID','SYNC_PROJECTION_INVALID']){
   expect(syncPreviewFailure('projector',code,'fixture').error).not.toContain('Beperk de selectie');
  }
 });
 it.each(['rpc','envelope','assets','payload','projector']as const)('retains a distinct %s phase without leaking provider text',phase=>{
  const result=syncPreviewFailure(phase,'PRIVATE https://provider.test?token=secret','correlation-fixture');
  expect(result).toMatchObject({ok:false,phase,code:'UNKNOWN',correlationId:'correlation-fixture'});
  expect(result.error).toContain('ontwerp blijven behouden');expect(result.error).not.toMatch(/PRIVATE|token|provider\.test/);
 });
 it.each([['42501','bronrechten'],['P2911','eenduidig'],['P2912','seizoen'],['PGRST202','databaseversie'],['08006','tijdelijk'],['23514','bronselectie']])('provides recovery for %s', (code,recovery)=>{
  expect(syncPreviewFailure('rpc',code,'fixture').error).toContain(recovery);
 });
});
