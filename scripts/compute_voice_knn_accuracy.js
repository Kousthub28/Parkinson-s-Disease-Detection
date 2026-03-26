import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEATURE_COLUMNS = [
  'meanPeriodPulses',
  'stdDevPeriodPulses',
  'locPctJitter',
  'locAbsJitter',
  'rapJitter',
  'ppq5Jitter',
  'ddpJitter',
  'locShimmer',
  'locDbShimmer',
  'apq3Shimmer',
  'apq5Shimmer',
  'apq11Shimmer',
  'ddaShimmer',
  'meanAutoCorrHarmonicity',
  'meanNoiseToHarmHarmonicity',
  'meanHarmToNoiseHarmonicity',
];

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a,b)=>a+b,0)/values.length;
}
function stddev(values, m) {
  if (values.length < 2) return 0;
  const v = values.reduce((s,x)=>s + (x-m)*(x-m),0)/(values.length-1);
  return Math.sqrt(Math.max(v,0));
}

function euclidean(a,b){
  let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return Math.sqrt(s);
}

function parseCsv(filePath){
  const raw = fs.readFileSync(filePath,'utf8');
  const rows = raw.split(/\r?\n/).filter(r=>r.trim().length>0);
  // find header row that contains the word 'class'
  let headerIndex = -1;
  for(let i=0;i<rows.length;i++){
    if (rows[i].toLowerCase().includes(',class') || rows[i].toLowerCase().endsWith(',class')) { headerIndex=i; break; }
  }
  if (headerIndex === -1) {
    // fallback: first row
    headerIndex = 0;
  }
  const headers = rows[headerIndex].split(',').map(h=>h.trim());
  const classIndex = headers.lastIndexOf('class');
  if (classIndex === -1) throw new Error('class column not found');
  const featureIndices = FEATURE_COLUMNS.map(k=>{
    const idx = headers.indexOf(k);
    if (idx === -1) throw new Error('Missing feature column: '+k);
    return idx;
  });

  const dataRows = rows.slice(headerIndex+1);
  const samples = [];
  for(const row of dataRows){
    const cols = row.split(',');
    if (cols.length !== headers.length) continue; // skip malformed
    const labelRaw = Number.parseFloat(cols[classIndex]);
    const label = labelRaw >= 0.5 ? 'Parkinsons' : 'Healthy';
    const features = FEATURE_COLUMNS.map((_,i)=>{
      const v = Number.parseFloat(cols[featureIndices[i]]);
      return Number.isFinite(v) ? v : 0;
    });
    samples.push({label, features});
  }
  return samples;
}

function computeStats(samples){
  const stats = [];
  for(let i=0;i<FEATURE_COLUMNS.length;i++){
    const vals = samples.map(s=>s.features[i]);
    const m = mean(vals);
    const sd = stddev(vals,m) || 1e-6;
    stats.push({m,sd});
  }
  return stats;
}

function normalise(features, stats){
  return features.map((v,i)=> (v - stats[i].m) / stats[i].sd );
}

function leaveOneOutAccuracy(normSamples, k){
  if (normSamples.length < 2) return null;
  let correct = 0;
  for(let i=0;i<normSamples.length;i++){
    const test = normSamples[i];
    const train = normSamples.filter((_,j)=>j!==i);
    // predict
    const neighbours = train.map(t=>({label:t.label, dist: euclidean(t.vector, test.vector)})).sort((a,b)=>a.dist-b.dist).slice(0,k);
    const votes = neighbours.reduce((acc,n)=>{ acc[n.label] = (acc[n.label]||0)+1; return acc; },{});
    const predicted = (votes['Parkinsons']||0) >= (votes['Healthy']||0) ? 'Parkinsons' : 'Healthy';
    if (predicted === test.label) correct++;
  }
  return correct / normSamples.length;
}

(async function main(){
  try{
    const csvPath = path.join(__dirname,'..','public','data','pd_speech_features.csv');
    if (!fs.existsSync(csvPath)) throw new Error('CSV not found at '+csvPath);
    console.log('Parsing CSV:', csvPath);
    const samples = parseCsv(csvPath);
    console.log('Parsed samples:', samples.length);

    const stats = computeStats(samples);
    const normSamples = samples.map(s=>({ label: s.label, vector: normalise(s.features, stats) }));

    const results = {};
    for(let k=1;k<=9;k+=2){
      const acc = leaveOneOutAccuracy(normSamples, k);
      results[k] = acc;
      console.log(`k=${k} accuracy=${(acc===null? 'n/a': (acc*100).toFixed(2)+'%')}`);
    }

    // also print sample distribution
    const dist = normSamples.reduce((acc,s)=>{ acc[s.label]=(acc[s.label]||0)+1; return acc; },{});
    console.log('Class distribution:', dist);

  }catch(err){
    console.error('Error:', err);
    process.exit(1);
  }
})();
