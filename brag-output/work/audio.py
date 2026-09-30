import numpy as np, wave
SR=44100; D=20.0; N=int(SR*D)
t_all=np.arange(N)/SR
rng=np.random.default_rng(7)
def mtof(m): return 440*2**((m-69)/12)
def buf(): return np.zeros(N)
def add(dst,sig,start):
    i=int(start*SR); j=min(N,i+len(sig))
    if i<N and j>i: dst[i:j]+=sig[:j-i]
def onepole(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); s=0.0
    for i in range(len(x)): s=(1-a)*x[i]+a*s; y[i]=s
    return y
def lp_fast(x,fc):
    # FFT brickwall-ish smooth lowpass
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/(1+(f/fc)**4); return np.fft.irfft(X,len(x))
def hp_fast(x,fc):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1-1/(1+(f/fc)**4); return np.fft.irfft(X,len(x))

BPM=120; beat=0.5
# A minor: Am F C G  (per 2s bar)
chords=[[57,60,64],[53,57,60],[48,52,55,60],[55,59,62]]
roots=[45,41,48,43]

pad=buf(); arp=buf(); bass=buf(); kick=buf(); hat=buf(); sfx=buf(); chime=buf()

# PAD — detuned saws, soft attack, per bar
for bar in range(10):
    c=chords[bar%4]; st=bar*2.0; L=2.3; n=int(L*SR); tt=np.arange(n)/SR
    env=np.minimum(1,tt/0.35)*np.minimum(1,(L-tt)/0.5).clip(0,1)
    s=np.zeros(n)
    for m in c:
        for det in (-0.08,0.0,0.08):
            f=mtof(m+12)*(1+det/100*6)
            s+=2*((tt*f+rng.random())%1)-1
    add(pad,s*env,st)
pad=lp_fast(pad,1400)
pad*=np.where(t_all<2.5,2.2,1.0)

# ARP — plucks on 8ths from 2.5 to 16.5
pat=[0,1,2,1,0,2,1,2]
def pluck(f,L=0.45,bright=6.0):
    n=int(L*SR); tt=np.arange(n)/SR
    s=sum((1/k)*np.sin(2*np.pi*f*k*tt)*np.exp(-tt*bright*k*0.7) for k in range(1,6))
    return s*np.minimum(1,tt/0.004)
k=0
t=2.5
while t<16.49:
    bar=int(t//2); c=chords[bar%4]; m=c[pat[k%8]%len(c)]+24
    add(arp,pluck(mtof(m))*(0.9 if k%2==0 else 0.65),t); t+=0.25; k+=1

# BASS — root on 8ths, 2.5–16.5
t=2.5
while t<16.49:
    bar=int(t//2); f=mtof(roots[bar%4]); n=int(0.24*SR); tt=np.arange(n)/SR
    s=np.tanh(1.6*np.sin(2*np.pi*f*tt)+0.3*np.sin(4*np.pi*f*tt))*np.exp(-tt*5)*np.minimum(1,tt/0.005)
    add(bass,s,t); t+=0.25

# KICK + duck envelope
duck=np.ones(N)
def kickhit(amp=1.0):
    n=int(0.35*SR); tt=np.arange(n)/SR
    f=45+95*np.exp(-tt*28); ph=2*np.pi*np.cumsum(f)/SR
    return amp*np.sin(ph)*np.exp(-tt*9)
kt=[2.5+i*beat for i in range(28)]+[16.5]
for t0 in kt:
    add(kick,kickhit(1.0 if t0!=16.5 else 1.1),t0)
    i=int(t0*SR); n=int(0.3*SR); tt=np.arange(n)/SR
    d=1-0.55*np.exp(-tt*12); j=min(N,i+n); duck[i:j]=np.minimum(duck[i:j],d[:j-i])

# HATS — offbeats from 8.5
for i in range(16):
    t0=8.75+i*beat
    if t0>16.4: break
    n=int(0.08*SR); s=rng.standard_normal(n)*np.exp(-np.arange(n)/SR*60)
    add(hat,s,t0)
hat=hp_fast(hat,7000)

# SFX — in key, soft
P0=2.3
taps=[P0+0.75,P0+3.0,P0+3.6,P0+4.45,P0+4.95]
for t0,m in zip(taps,[81,84,76,79,88]):
    add(sfx,pluck(mtof(m),0.3,14)*0.55,t0)
for i in range(1,10):  # typing ticks
    t0=P0+1.25+i*0.16; n=int(0.03*SR); s=rng.standard_normal(n)*np.exp(-np.arange(n)/SR*180)
    add(sfx,hp_fast(np.pad(s,(0,2000)),2500)[:n+2000]*0.12,t0)
penta=[69,72,74,76,79,81,84,86,88,91,93]
for i in range(11): add(sfx,pluck(mtof(penta[i]),0.25,18)*0.22,9.0+i*0.085)
def whoosh(t0,L=0.6,peak=0.7):
    n=int(L*SR); tt=np.arange(n)/SR; env=np.sin(np.pi*np.clip(tt/L,0,1))**2
    s=rng.standard_normal(n)*env; s=lp_fast(np.pad(s,(0,4000)),1800)[:n]
    add(sfx,s*0.35,t0-L*peak)
for t0 in (2.5,8.5,12.5,16.5): whoosh(t0)
def bell(t0,notes,amp=0.35,L=2.5):
    n=int(L*SR); tt=np.arange(n)/SR; s=np.zeros(n)
    for j,m in enumerate(notes):
        f=mtof(m); d=tt-j*0.06; d=np.clip(d,0,None); on=(tt>=j*0.06)
        s+=on*(np.sin(2*np.pi*f*d)+0.35*np.sin(2*np.pi*f*2.76*d)*np.exp(-d*6)+0.2*np.sin(2*np.pi*f*5.4*d)*np.exp(-d*10))*np.exp(-d*2.2)
    add(chime,s*amp,t0)
bell(P0+5.1,[81,84,88])      # Sent
bell(16.55,[69,76,81,84],0.45,3.4)  # logo

# riser into drop
n=int(2.3*SR); tt=np.arange(n)/SR
r=rng.standard_normal(n)*(tt/2.3)**2; r=hp_fast(np.pad(r,(0,1000)),600)[:n]
add(sfx,r*0.12,0.2)

# outro final chord pad sustain (16.5–20) Am add9
n=int(3.5*SR); tt=np.arange(n)/SR; s=np.zeros(n)
for m in (57,64,69,71,72):
    for det in (-0.1,0.1): s+=2*((tt*mtof(m+12)*(1+det/100*5))%1)-1
s=lp_fast(np.pad(s,(0,1000)),1600)[:n]*np.minimum(1,tt/0.2)*np.clip((3.5-tt)/2.2,0,1)
outpad=buf(); add(outpad,s,16.5)

def norm(x): return x/ (np.max(np.abs(x))+1e-9)
mix = (0.16*norm(pad)*duck*np.where(t_all>16.5,0.0,1)*np.clip((16.8-t_all)/0.3,0,1)
     + 0.20*norm(outpad)
     + 0.17*norm(arp)*duck
     + 0.26*norm(bass)*duck
     + 0.55*norm(kick)
     + 0.035*norm(hat)
     + 0.20*norm(sfx)
     + 0.22*norm(chime))
# reverb (shared space)
irn=int(1.8*SR); ir=rng.standard_normal(irn)*np.exp(-np.arange(irn)/SR*3.2); ir=lp_fast(ir,5000); ir/=np.sqrt(np.sum(ir**2))
send=0.8*norm(pad)*0.16+0.17*norm(arp)+0.2*norm(sfx)+0.22*norm(chime)+0.2*norm(outpad)
L=N+irn; F=1<<int(np.ceil(np.log2(L)))
wet=np.fft.irfft(np.fft.rfft(send,F)*np.fft.rfft(ir,F),F)[:N]
mix=mix+0.22*wet
# gentle tone: tame harshness
mix=lp_fast(mix,12000)
fade=np.clip((D-t_all)/0.4,0,1); mix*=fade
mix=np.tanh(mix*1.3)/np.tanh(1.3)
mix=mix/np.max(np.abs(mix))*0.89
st=np.stack([mix,mix],1)
# slight stereo width on wet
st[:,0]+=0.04*np.roll(wet,220)/np.max(np.abs(wet)); st[:,1]+=0.04*np.roll(wet,-220)/np.max(np.abs(wet))
st=st/np.max(np.abs(st))*0.89
with wave.open('audio.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
print('ok')
