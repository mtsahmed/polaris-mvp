import { describe, expect, it } from "vitest";
import { bareDomain, emailStatusOf, readMatch, readSearch, searchQuery } from "./apollo-map";

describe("bareDomain", () => {
  it("strips scheme, www and path", () => {
    expect(bareDomain("https://www.NaturaHQ.com/en-us/about")).toBe("naturahq.com");
  });
});

describe("searchQuery", () => {
  it("puts domain and titles in Apollo's array parameters", () => {
    const q = new URLSearchParams(searchQuery("https://www.example.com", ["Brand Manager", " ", "Branch Manager"]));
    expect(q.getAll("q_organization_domains_list[]")).toEqual(["example.com"]);
    expect(q.getAll("person_titles[]")).toEqual(["Brand Manager", "Branch Manager"]);
    expect(q.get("per_page")).toBe("10");
  });
});

describe("readSearch", () => {
  it("reads people with obfuscated last names and skips rows without an id", () => {
    const out = readSearch({
      people: [
        { id: "a1", first_name: "Jordan", last_name_obfuscated: "Bl***e", title: "Brand Manager", has_email: true },
        { first_name: "No id" },
      ],
    });
    expect(out).toEqual([{ apolloId: "a1", displayName: "Jordan Bl***e", title: "Brand Manager", hasEmail: true }]);
  });

  it("returns nothing for an unexpected shape", () => {
    expect(readSearch({})).toEqual([]);
    expect(readSearch(null)).toEqual([]);
  });
});

describe("emailStatusOf", () => {
  it("only Apollo's verified counts as verified", () => {
    expect(emailStatusOf("a@b.com", "verified")).toBe("verified");
    expect(emailStatusOf("a@b.com", "likely to engage")).toBe("unverified");
    expect(emailStatusOf(null, "verified")).toBe("missing");
  });
});

describe("readMatch", () => {
  it("reads the person and ignores locked placeholder emails", () => {
    const p = readMatch({
      person: { id: "a1", name: "Jordan Blake", title: "CEO", email: "email_not_unlocked@domain.com", email_status: "verified" },
    });
    expect(p).toMatchObject({ apolloId: "a1", name: "Jordan Blake", email: null, emailStatus: "missing" });
  });

  it("returns null when Apollo found no one", () => {
    expect(readMatch({ person: null })).toBeNull();
  });
});
