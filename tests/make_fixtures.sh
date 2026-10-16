#!/bin/sh
# Re-creates the video fixtures s222/s223 use (too big to commit; needs ffmpeg with libx264, libx265, libvpx). Run from tests/
mkdir -p fx && cd fx
ffmpeg -v error -y -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=f=440 -t 4 -c:v libx264 -pix_fmt yuv420p -c:a aac h264.mp4
ffmpeg -v error -y -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=f=440 -t 4 -c:v libx265 -tag:v hvc1 -c:a libopus hevc_opus.mp4
ffmpeg -v error -y -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=f=440 -t 4 -c:v libvpx-vp9 -b:v 1M -c:a libopus vp9.webm
ffmpeg -v error -y -f lavfi -i sine=f=440 -t 4 -c:a libopus audioonly.webm
head -c 2000000 /dev/urandom > garbage.mp4
ffmpeg -v error -y -f lavfi -i testsrc=size=5000x500:rate=10 -t 2 -c:v libvpx -b:v 1M wide5k.webm
ffmpeg -v error -y -f lavfi -i "testsrc2=size=1920x1080:rate=30,noise=alls=60:allf=t" -f lavfi -i sine=f=330 -t 40 -c:v libvpx -deadline realtime -cpu-used 8 -b:v 55M -minrate 55M -maxrate 55M -bufsize 10M -c:a libopus big.webm
ffmpeg -v error -y -i big.webm -t 27 -c copy mid.webm
printf "file 'big.webm'\nfile 'mid.webm'\n" > l.txt && ffmpeg -v error -y -f concat -safe 0 -i l.txt -c copy huge.webm
ffmpeg -v error -y -f lavfi -i testsrc=size=3840x2160:rate=10 -t 2 -c:v libvpx -b:v 1M 4k.webm
# s212 / s217 / s218 pick a small portrait clip from the output folder (OUT, default tests/out)
mkdir -p ../out && ffmpeg -v error -y -f lavfi -i testsrc=size=1080x1920:rate=30 -t 1 -c:v libvpx -b:v 2M ../out/hd.webm
