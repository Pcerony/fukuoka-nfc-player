package space.heisei.fukuokafootsteps;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import java.nio.charset.StandardCharsets;
import org.junit.Test;

public class TagTextTest {
    @Test public void readsTheExistingFourCards() {
        for (String suffix : new String[]{"", ":02", ":03", ":04"}) {
            String marker = "fukuoka-voice-player:v1" + suffix;
            assertEquals(marker, TagText.marker(("\u0002en" + marker).getBytes(StandardCharsets.UTF_8)));
        }
    }

    @Test public void rejectsUnregisteredAndTruncatedRecords() {
        assertNull(TagText.marker("\u0002enfukuoka-voice-player:v1:05".getBytes(StandardCharsets.UTF_8)));
        assertNull(TagText.marker(new byte[]{7, 'e', 'n'}));
    }
}
