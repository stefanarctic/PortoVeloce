import * as T from 'three';

// Build an orthonormal road frame. Applying pitch then yaw with XYZ Euler
// rotations rolled east/west spans sideways, pushing their slabs into the lanes.
export function spanFrame(p,q){
  const forward=new T.Vector3(q.x-p.x,(q.y??0)-(p.y??0),q.z-p.z);
  const length=forward.length();forward.divideScalar(length);
  const right=new T.Vector3(forward.z,0,-forward.x).normalize();
  const up=new T.Vector3().crossVectors(forward,right);
  const matrix=new T.Matrix4().makeBasis(right,up,forward);
  return {length,right,up,forward,rotation:new T.Euler().setFromRotationMatrix(matrix,'XYZ')};
}

// A continuous slab follows the same sampled surface as the asphalt. Its top
// stays below the road across the entire width, including curved approaches.
export function deckGeometry(road,at,offset){
  const vertices=[],indices=[];
  const steps=Math.ceil(road.length/8),half=road.halfWidth+1.4;
  for(let i=0;i<=steps;i++){
    const p=at(road,road.length*i/steps);
    for(const [side,height] of [[-half,-.08],[half,-.08],[-half,-.88],[half,-.88]]){
      const q=offset(p,side);vertices.push(q.x,p.y+height,q.z);
    }
    if(i===steps)continue;
    const k=i*4;
    indices.push(k,k+1,k+4,k+1,k+5,k+4, k+2,k+6,k+3,k+3,k+6,k+7,
      k,k+4,k+2,k+2,k+4,k+6, k+1,k+3,k+5,k+3,k+7,k+5);
  }
  const end=steps*4;indices.push(0,2,1,1,2,3,end,end+1,end+2,end+1,end+3,end+2);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
}
