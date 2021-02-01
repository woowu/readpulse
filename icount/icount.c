#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <linux/serial.h>

int main(int argc, const char **argv)
{
    const char *dev;
    int fd;
    struct serial_icounter_struct icounters;
    int code;

    if (argc != 2) {
        fprintf(stderr, "bad syntax\n");
        return 1;
    }
    dev = argv[1];

    fd = open(dev, O_RDONLY);
    if (fd == -1) {
        fprintf(stderr, "cannot open %s\n", dev);
        return 1;
    }

    code = 0;
    memset(&icounters, 0, sizeof(icounters));
    if (ioctl(fd, TIOCGICOUNT, &icounters) == -1) {
        fprintf(stderr, "ioctrl error: %s\n", strerror(errno));
        code = 1;
        goto end;
    }
    printf("cts %d dcd %d rx %d tx %d frame %d overrun %d parity %d brk %d\n",
            icounters.cts, icounters.dcd,
            icounters.rx, icounters.tx, icounters.frame, icounters.overrun,
            icounters.parity, icounters.brk);

end:
    close(fd);
    return code;
}
