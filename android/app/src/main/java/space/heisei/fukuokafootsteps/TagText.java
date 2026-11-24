package space.heisei.fukuokafootsteps;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

final class TagText {
    private static final List<String> MARKERS = Arrays.asList(
        "fukuoka-voice-player:v1", "fukuoka-voice-player:v1:02",
        "fukuoka-voice-player:v1:03", "fukuoka-voice-player:v1:04");

    static String marker(byte[] payload) {
        if (payload.length == 0) return null;
        int offset = 1 + (payload[0] & 0x3f);
        if (offset >= payload.length) return null;
        var encoding = (payload[0] & 0x80) == 0 ? StandardCharsets.UTF_8 : StandardCharsets.UTF_16;
        String text = new String(payload, offset, payload.length - offset, encoding);
        return MARKERS.contains(text) ? text : null;
    }
}
