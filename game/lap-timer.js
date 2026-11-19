// Simulation time only: opening a menu never adds time to a lap.
export class LapTimer{
  constructor(length,startLine,best=0){this.length=length;this.startLine=startLine;this.best=best;this.reset();}
  reset(){this.previous=null;this.running=false;this.elapsed=0;this.invalid=false;this.sector=0;this.reverse=0;this.last=0;this.count=0;}
  update(dt,station,{safe=station!=null,wall=false}={}){
    if(this.running)this.elapsed+=dt;
    if(this.running&&(!safe||wall))this.invalid=true;
    if(station==null){this.previous=null;return null;}
    const relative=(station-this.startLine+this.length)%this.length,previous=this.previous;this.previous=relative;
    if(previous==null)return null;
    let delta=relative-previous;if(delta>this.length/2)delta-=this.length;if(delta<-this.length/2)delta+=this.length;
    if(Math.abs(delta)>150*dt+3){if(this.running)this.invalid=true;return null;}
    if(this.running){this.reverse=Math.max(0,this.reverse-delta);if(this.reverse>10)this.invalid=true;}
    if(delta>0&&relative<previous){
      const completed=this.running&&!this.invalid&&this.sector===3?this.elapsed:null;
      if(completed){this.last=completed;this.best=Math.min(this.best||completed,completed);this.count++;}
      this.running=true;this.elapsed=0;this.invalid=!safe||wall;this.sector=0;this.reverse=0;
      return completed;
    }
    if(this.running&&delta>0){const next=(this.sector+1)*this.length/4;if(previous<next&&relative>=next&&this.sector<3)this.sector++;}
    return null;
  }
}
